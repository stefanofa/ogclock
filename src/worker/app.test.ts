import { afterEach, describe, expect, it, vi } from "vitest";
import { CANONICAL, zone } from "../core/fixtures.ts";
import { AUTO, frame, share } from "../core/tokens.ts";
import { direct } from "../og/director.ts";
import type { Scene } from "../og/render.ts";
import type { Boot, Now } from "../web/protocol.ts";
import { brandCard, handle, type Runtime } from "./app.ts";
import { bootJson, head } from "./page.ts";

const ORIGIN = "https://ogclock.app";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
const CARD = brandCard(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));

afterEach(() => vi.restoreAllMocks());

/** A runtime with a frozen clock, a counting renderer and an in-memory cache. */
const fake = (now = CANONICAL.instant + 42_000) => {
	const store = new Map<string, Response>();
	const rendered: Scene[] = [];
	const runtime: Runtime = {
		now: () => now,
		render: async (scene) => {
			rendered.push(scene);
			return PNG;
		},
		card: CARD,
		zoneOf: () => zone("Asia/Tokyo"),
		/** The real head and boot data in a stand-in shell; HTMLRewriter runs only in workerd. */
		page: async ({ preview, boot }) =>
			new Response(
				`<!doctype html><html><head><meta charset="utf-8">${head(preview).value}</head><body><script id="boot" type="application/json">${bootJson(boot)}</script></body></html>`,
			),
		cache: {
			match: async (req) => store.get(req.url)?.clone(),
			put: async (req, res) => void store.set(req.url, res),
		},
		defer: (work) => void work,
	};
	return { runtime, rendered };
};

const get = (path: string, runtime: Runtime, init?: RequestInit) =>
	handle(new Request(`${ORIGIN}${path}`, init), runtime);

const meta = (body: string, property: string) =>
	new RegExp(`<meta (?:property|name)="${property}" content="([^"]*)"`).exec(body)?.[1];

const bootOf = (body: string): Boot =>
	JSON.parse(/<script id="boot" type="application\/json">(.*?)<\/script>/.exec(body)?.[1] ?? "");

describe("share page", () => {
	const token = share.encode({ zone: zone("Asia/Tokyo"), theme: AUTO, nonce: 12345n });

	it("previews the minute it is fetched, in the link's zone", async () => {
		const res = await get(`/${token}`, fake().runtime);
		const body = await res.text();
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(meta(body, "og:title")).toBe("60.6% of Wednesday is already gone.");
		expect(meta(body, "og:url")).toBe(`${ORIGIN}/${token}`);

		const image = meta(body, "og:image") ?? "";
		expect(frame.decode(/\/og\/([0-9a-z]+)\.png$/.exec(image)?.[1] ?? "")).toEqual({
			theme: 1,
			instant: CANONICAL.instant,
			zone: CANONICAL.zone,
		});
	});

	it("puts every og tag before the body", async () => {
		const body = await (await get(`/${token}`, fake().runtime)).text();
		expect(body.indexOf("og:image")).toBeLessThan(body.indexOf("<body>"));
		expect(body.indexOf("<body>")).toBeLessThan(4096);
	});

	it("escapes what it prints", async () => {
		const body = await (await get(`/${token}`, fake().runtime)).text();
		expect(body).not.toMatch(/content="[^"]*</);
		expect(bootJson({ host: "</script><script>" } as unknown as Boot)).not.toContain("<");
	});

	it("keeps the sender's theme but shows the visitor their own zone", async () => {
		const sent = share.encode({ zone: zone("Europe/Rome"), theme: 2, nonce: 7n });
		const boot = bootOf(await (await get(`/${sent}`, fake().runtime)).text());
		expect(boot).toMatchObject({ zone: zone("Asia/Tokyo").code, theme: 2, received: true });
		expect(boot.now.minute.instant).toBe(CANONICAL.instant);
		expect(share.decode(boot.link)).toMatchObject({ zone: zone("Asia/Tokyo"), theme: 2 });
		expect(boot.link).not.toBe(sent);
	});
});

describe("now", () => {
	const tokyo = zone("Asia/Tokyo").code;

	it("lists every theme's image for this minute and the next, cached until :00", async () => {
		const res = await get(`/api/now/${tokyo}`, fake().runtime);
		const { minute, next } = (await res.json()) as Now;
		expect(res.headers.get("cache-control")).toBe("public, max-age=0, s-maxage=18");
		expect(minute).toMatchObject({ instant: CANONICAL.instant, auto: direct(CANONICAL).code });
		expect(next.instant).toBe(CANONICAL.instant + 60_000);
		for (const { code, image } of minute.themes) {
			expect(frame.decode(/^\/og\/([0-9a-z]{10})\.png$/.exec(image)?.[1] ?? "")).toEqual({
				theme: code,
				instant: CANONICAL.instant,
				zone: CANONICAL.zone,
			});
		}
	});

	it("404s zone codes that do not exist or are not canonical", async () => {
		expect((await get("/api/now/9999", fake().runtime)).status).toBe(404);
		expect((await get(`/api/now/0${tokyo}`, fake().runtime)).status).toBe(404);
	});
});

describe("image", () => {
	const token = frame.encode({ theme: 2, instant: CANONICAL.instant, zone: CANONICAL.zone });

	it("renders once, then serves the cached bytes forever", async () => {
		const { runtime, rendered } = fake();
		const first = await get(`/og/${token}.png`, runtime);
		const second = await get(`/og/${token}.png?utm_source=x`, runtime);
		expect(first.headers.get("content-type")).toBe("image/png");
		expect(first.headers.get("cache-control")).toContain("immutable");
		expect(second.status).toBe(200);
		expect(rendered).toHaveLength(1);
		expect(rendered[0]?.fonts).toContain("inter-tight-800");
	});

	it("refuses tokens it could not have issued", async () => {
		expect((await get("/og/zzzzzzzzzz.png", fake().runtime)).status).toBe(404);
		const unknownTheme = frame.encode({
			theme: 99,
			instant: CANONICAL.instant,
			zone: CANONICAL.zone,
		});
		expect((await get(`/og/${unknownTheme}.png`, fake().runtime)).status).toBe(404);
	});

	it("serves the brand card, uncached, when a render fails", async () => {
		const { runtime, rendered } = fake();
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const failing: Runtime = {
			...runtime,
			render: async () => {
				throw new Error("wasm trap");
			},
		};
		const res = await get(`/og/${token}.png`, failing);
		expect(res.status).toBe(200);
		expect(res.headers.get("content-type")).toBe("image/png");
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(CARD.png);
		expect(errors).toHaveBeenCalled();

		await get(`/og/${token}.png`, runtime);
		expect(rendered).toHaveLength(1);
	});

	it("renders only minutes the server could have issued by now", async () => {
		const { runtime } = fake();
		const at = (instant: number) =>
			get(`/og/${frame.encode({ theme: 2, instant, zone: CANONICAL.zone })}.png`, runtime);
		expect((await at(CANONICAL.instant + 60_000)).status).toBe(200);
		expect((await at(Date.parse("2020-01-01T00:00Z"))).status).toBe(200);
		expect((await at(CANONICAL.instant + 3 * 60_000)).status).toBe(404);
	});
});

describe("home", () => {
	it("mints a fresh link in the visitor's zone and shows a timeless card", async () => {
		const body = await (await get("/", fake().runtime)).text();
		expect(meta(body, "og:image")).toBe(ORIGIN + CARD.path);
		const boot = bootOf(body);
		expect(share.decode(boot.link)).toMatchObject({ zone: zone("Asia/Tokyo"), theme: AUTO });
		expect(boot).toMatchObject({ host: "ogclock.app", theme: AUTO, received: false });
	});

	it("treats a garbled share path as home", async () => {
		const res = await get("/not-a-token", fake().runtime);
		expect(res.status).toBe(200);
		expect(meta(await res.text(), "og:image")).toBe(ORIGIN + CARD.path);
	});

	it("serves the card at a URL that changes when the design does", async () => {
		const res = await get(CARD.path, fake().runtime);
		expect(res.headers.get("cache-control")).toContain("immutable");
		expect(new Uint8Array(await res.arrayBuffer())).toEqual(CARD.png);
		const redesign = brandCard(new Uint8Array([...CARD.png, 0]));
		expect(redesign.path).not.toBe(CARD.path);
		expect((await get(redesign.path, fake().runtime)).status).toBe(404);
	});
});

describe("protocol", () => {
	it("answers HEAD without a body and rejects writes", async () => {
		const head = await get("/", fake().runtime, { method: "HEAD" });
		expect(head.status).toBe(200);
		expect(await head.text()).toBe("");
		expect((await get("/", fake().runtime, { method: "POST" })).status).toBe(405);
	});

	it("answers a failed page with an uncached 500", async () => {
		const { runtime } = fake();
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await get("/", {
			...runtime,
			page: async () => {
				throw new Error("assets unavailable");
			},
		});
		expect(res.status).toBe(500);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(errors).toHaveBeenCalled();
	});

	it("404s nested unknown paths", async () => {
		expect((await get("/a/b", fake().runtime)).status).toBe(404);
	});
});
