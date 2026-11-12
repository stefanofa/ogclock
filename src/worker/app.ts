import { MINUTE, type Moment, momentAt } from "../core/moment.ts";
import { AUTO, frame, randomNonce, type Share, share } from "../core/tokens.ts";
import { type Zone, zoneByCode } from "../core/zone.ts";
import { direct, resolveTheme } from "../og/director.ts";
import { type Render, sceneOf } from "../og/render.ts";
import type { Theme } from "../og/theme.ts";
import { THEMES, themeByCode } from "../og/themes/index.ts";
import type { Minute, Now } from "../web/protocol.ts";
import type { Page, Preview } from "./page.ts";

/** The brand card, prebuilt by `pnpm gen:card`. */
export interface Card {
	readonly png: Uint8Array<ArrayBuffer>;
	/** Named after the bytes, so a redesign reaches every cache under a new URL. */
	readonly path: string;
}

/** FNV-1a over the bytes. 32 bits are enough to tell one design from the next. */
export const brandCard = (png: Uint8Array<ArrayBuffer>): Card => {
	const hash = png.reduce((h, byte) => Math.imul(h ^ byte, 0x01000193) >>> 0, 0x811c9dc5);
	return { png, path: `/card-${hash.toString(36)}.png` };
};

/** Everything the app needs from its runtime, injected so the handler stays testable. */
export interface Runtime {
	readonly now: () => number;
	readonly render: Render;
	/** Served for the bare domain, and in place of any image whose render failed. */
	readonly card: Card;
	/** The visitor's zone as the edge sees it. */
	readonly zoneOf: (request: Request) => Zone;
	/** The built page shell, personalised for one request. */
	readonly page: (page: Page) => Promise<Response>;
	readonly cache: {
		readonly match: (request: Request) => Promise<Response | undefined>;
		readonly put: (request: Request, response: Response) => Promise<void>;
	};
	/** Keeps the isolate alive for work that must not delay the response. */
	readonly defer: (work: Promise<unknown>) => void;
}

const SECURITY = {
	"x-content-type-options": "nosniff",
	"referrer-policy": "no-referrer",
} as const;

const IMMUTABLE = "public, max-age=31536000, immutable";

const png = (bytes: Uint8Array<ArrayBuffer>, cacheControl: string) =>
	new Response(bytes, {
		headers: {
			"content-type": "image/png",
			"content-length": String(bytes.byteLength),
			"cache-control": cacheControl,
			...SECURITY,
		},
	});

const notFound = () =>
	new Response("Not found", { status: 404, headers: { "cache-control": "no-store", ...SECURITY } });

const serverError = () =>
	new Response("Server error", {
		status: 500,
		headers: { "cache-control": "no-store", ...SECURITY },
	});

/** Renders once per edge location, then serves the cached bytes. */
const cached = async (
	request: Request,
	runtime: Runtime,
	draw: () => Promise<Uint8Array<ArrayBuffer>>,
) => {
	const key = new Request(new URL(request.url).origin + new URL(request.url).pathname);
	const hit = await runtime.cache.match(key);
	if (hit) return hit;
	const response = png(await draw(), IMMUTABLE);
	runtime.defer(runtime.cache.put(key, response.clone()));
	return response;
};

/** The immutable image path for one theme at one moment. */
const imagePath = (theme: Theme, m: Moment) =>
	`/og/${frame.encode({ theme: theme.code, instant: m.instant, zone: m.zone })}.png`;

const minuteAt = (instant: number, zone: Zone): Minute => {
	const m = momentAt(instant, zone);
	return {
		instant: m.instant,
		zone: zone.code,
		auto: direct(m).code,
		themes: THEMES.map((theme) => ({
			code: theme.code,
			id: theme.id,
			name: theme.name,
			line: theme.line(m),
			image: imagePath(theme, m),
		})),
	};
};

const nowIn = (instant: number, zone: Zone): Now => ({
	minute: minuteAt(instant, zone),
	next: minuteAt(instant + MINUTE, zone),
});

/**
 * The customizer, for a visitor in their own zone. A received link only preselects its
 * theme: the link's zone and time belong to whoever sent it.
 */
const page = async (request: Request, runtime: Runtime, preview: Preview, received?: Share) => {
	const zone = runtime.zoneOf(request);
	const now = runtime.now();
	const theme = received && themeByCode(received.theme) ? received.theme : AUTO;
	const response = await runtime.page({
		preview,
		boot: {
			host: new URL(request.url).host,
			zone: zone.code,
			link: share.encode({ zone, theme, nonce: randomNonce() }),
			theme,
			received: received !== undefined,
			serverNow: now,
			now: nowIn(now, zone),
		},
	});
	return new Response(response.body, {
		status: response.status,
		headers: {
			"content-type": "text/html; charset=utf-8",
			"cache-control": "no-store",
			...SECURITY,
		},
	});
};

/** Crawlers see the minute they fetch, in the sender's zone. */
const shareRoute = (token: string, request: Request, runtime: Runtime) => {
	const link = share.decode(token);
	if (!link) return home(request, runtime);
	const origin = new URL(request.url).origin;
	const m = momentAt(runtime.now(), link.zone);
	const theme = resolveTheme(link.theme, m);
	const line = theme.line(m);
	return page(
		request,
		runtime,
		{ url: `${origin}/${token}`, title: line, image: origin + imagePath(theme, m), alt: line },
		link,
	);
};

/** The bare domain shows a timeless card: a root URL would freeze one minute in caches. */
const home = (request: Request, runtime: Runtime) => {
	const origin = new URL(request.url).origin;
	return page(request, runtime, {
		url: `${origin}/`,
		title: "ogclock: this link knows when you send it",
		image: origin + runtime.card.path,
		alt: "This link knows when you send it.",
	});
};

/** Every theme's look for this minute and the next. Shared caches may keep it until :00. */
const nowRoute = (code: string, _request: Request, runtime: Runtime) => {
	const zone = zoneByCode(Number(code));
	if (!zone) return notFound();
	const now = runtime.now();
	const body = nowIn(now, zone);
	const fresh = Math.floor((body.next.instant - now) / 1000);
	return Response.json(body, {
		headers: { "cache-control": `public, max-age=0, s-maxage=${fresh}`, ...SECURITY },
	});
};

/** Pages only issue this minute and the next; the slack absorbs clock skew between edges. */
const LATEST_FRAME = 2 * MINUTE;

/**
 * A crawler like Reddit fetches the image once per post, so a failed render answers with
 * the brand card, never cached, rather than an error page.
 */
const imageRoute = async (token: string, request: Request, runtime: Runtime) => {
	const requested = frame.decode(token);
	const theme = requested && themeByCode(requested.theme);
	if (!requested || !theme || requested.instant > runtime.now() + LATEST_FRAME) return notFound();
	try {
		return await cached(request, runtime, () =>
			runtime.render(sceneOf(theme, momentAt(requested.instant, requested.zone))),
		);
	} catch (error) {
		console.error(`render failed for /og/${token}.png`, error);
		return png(runtime.card.png, "no-store");
	}
};

const cardRoute = (_: string, request: Request, runtime: Runtime) =>
	new URL(request.url).pathname === runtime.card.path
		? png(runtime.card.png, IMMUTABLE)
		: notFound();

type Handler = (match: string, request: Request, runtime: Runtime) => Response | Promise<Response>;

/** Ordered route table; the first pattern that matches handles the request. */
const ROUTES: readonly (readonly [RegExp, Handler])[] = [
	[/^\/og\/([0-9a-z]{10})\.png$/, imageRoute],
	[/^\/card-[0-9a-z]+\.png$/, cardRoute],
	[/^\/api\/now\/(0|[1-9][0-9]{0,3})$/, nowRoute],
	[/^\/([0-9a-z]{15})$/, shareRoute],
	[/^\/[^/.]*$/, (_, request, runtime) => home(request, runtime)],
];

export const handle = async (request: Request, runtime: Runtime): Promise<Response> => {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response("Method not allowed", {
			status: 405,
			headers: { allow: "GET, HEAD", ...SECURITY },
		});
	}
	const { pathname } = new URL(request.url);
	for (const [pattern, handler] of ROUTES) {
		const match = pattern.exec(pathname);
		if (!match) continue;
		let response: Response;
		try {
			response = await handler(match[1] ?? "", request, runtime);
		} catch (error) {
			console.error(`${request.method} ${pathname} failed`, error);
			response = serverError();
		}
		return request.method === "HEAD" ? new Response(null, response) : response;
	}
	return notFound();
};
