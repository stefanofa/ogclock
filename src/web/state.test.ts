import { describe, expect, it } from "vitest";
import { at, zone } from "../core/fixtures.ts";
import { AUTO } from "../core/tokens.ts";
import type { Boot, Minute } from "./protocol.ts";
import { slots } from "./slots.ts";
import { type Action, initial, reduce, type State, shown } from "./state.ts";

const T = Date.UTC(2026, 10, 11, 5, 32);

/** One minute's looks, by its wall clock in Tokyo on 11 November 2026. */
const minute = (time: string, auto = 1): Minute => ({
	instant: at(`2026-11-11T${time}`).instant,
	zone: zone("Asia/Tokyo").code,
	auto,
	themes: [1, 2, 3].map((code) => ({
		code,
		id: `theme-${code}`,
		name: `Theme ${code}`,
		line: `Line ${code} at ${time}`,
		image: `/og/${code}-${time}.png`,
	})),
});

const boot: Boot = {
	host: "ogclock.app",
	zone: zone("Asia/Tokyo").code,
	link: "first",
	theme: AUTO,
	received: false,
	serverNow: T + 32_000,
	now: { minute: minute("14:32"), next: minute("14:33", 2) },
};

const run = (state: State, ...actions: Action[]) => actions.reduce(reduce, state);
const start = initial(boot, T + 32_000);

describe("minute", () => {
	it("counts down and turns over on :00 to the frames it already has", () => {
		expect(slots(start)).toMatchObject({ time: "14:32", next: "14:33", left: "0:28" });
		const turned = run(start, { type: "tick", now: T + 60_000 });
		expect(slots(turned).time).toBe("14:33");
		expect(turned.next).toBeUndefined();
		expect(shown(turned).image).toBe("/og/2-14:33.png");
		expect(slots(turned)).toMatchObject({ next: "14:34", left: "1:00" });
	});

	it("drops frames from a tab that slept past them, and keeps only newer data", () => {
		const woke = run(start, { type: "tick", now: T + 5 * 60_000 });
		expect(woke.next).toBeUndefined();
		expect(slots(woke).time).toBe("14:32");

		const fetched = { minute: minute("14:37"), next: minute("14:38") };
		const stale = { minute: minute("14:31"), next: minute("14:32") };
		expect(run(woke, { type: "now", now: stale })).toBe(woke);
		expect(slots(run(woke, { type: "now", now: fetched })).time).toBe("14:37");
	});

	it("reads times in the zone the images were drawn for, until the visitor's zone arrives", () => {
		const london = initial({ ...boot, zone: zone("Europe/London").code }, T + 32_000);
		expect(slots(london)).toMatchObject({ time: "14:32", next: "14:33" });
	});
});

describe("device clock", () => {
	const TURN = T + 60_000;
	const following = { minute: minute("14:33", 2), next: minute("14:34") };

	it("runs 3 minutes ahead: the minute still turns on the server's :00 and fetched data holds", () => {
		const AHEAD = 3 * 60_000;
		const ahead = initial(boot, boot.serverNow + AHEAD);
		expect(slots(ahead)).toMatchObject({ time: "14:32", left: "0:28" });

		const before = run(ahead, { type: "tick", now: TURN - 1000 + AHEAD });
		expect(slots(before).time).toBe("14:32");
		expect(before.next).toBe(boot.now.next);

		const turned = run(before, { type: "tick", now: TURN + AHEAD });
		expect(slots(turned).time).toBe("14:33");
		const fetched = run(turned, { type: "now", now: following });
		const later = run(fetched, { type: "tick", now: TURN + 1000 + AHEAD });
		expect(later.next).toBe(following.next);
	});

	it("runs 30 seconds behind: the minute turns on the server's :00, so a copy promises it", () => {
		const BEHIND = -30_000;
		const behind = initial(boot, boot.serverNow + BEHIND);
		expect(slots(behind)).toMatchObject({ time: "14:32", left: "0:28" });

		const turned = run(behind, { type: "tick", now: TURN + BEHIND }, { type: "copied" });
		expect(slots(turned).announce).toBe("Copied. Paste it now and they'll see 14:33.");
	});
});

describe("theme", () => {
	it("Auto follows the director; a chosen theme sticks across minutes", () => {
		expect(shown(start).code).toBe(1);
		const chosen = run(start, { type: "theme", theme: 3, link: "second" });
		expect(slots(chosen)).toMatchObject({
			link: "second",
			choice: "Theme 3",
			"checked-3": "true",
			"tab-3": "0",
			"checked-0": "false",
			"tab-0": "-1",
		});
		expect(shown(run(chosen, { type: "tick", now: T + 60_000 })).image).toBe("/og/3-14:33.png");
	});
});

describe("copy", () => {
	it("goes idle → copied → idle, and a stale timer cannot end a newer copy", () => {
		const once = run(start, { type: "copied" });
		expect(slots(once)).toMatchObject({ copy: "copied", toast: "shown" });
		expect(slots(once).announce).toBe("Copied. Paste it now and they'll see 14:32.");

		const twice = run(once, { type: "copied" });
		const early = run(twice, { type: "settle", copy: 1 }, { type: "dismiss", copy: 1 });
		expect(early).toMatchObject({ copy: "copied", toast: true });

		const done = run(early, { type: "settle", copy: 2 }, { type: "dismiss", copy: 2 });
		expect(slots(done)).toMatchObject({ copy: "idle", toast: "hidden", announce: "" });
	});

	it("hands out each link once: the next is minted at the send, the slug catches up after", () => {
		const once = run(start, { type: "sent", link: "second" });
		expect(once.link).toBe("second");
		expect(slots(once).link).toBe("first");

		const twice = run(once, { type: "sent", link: "third" });
		expect(twice.link).toBe("third");
		expect(slots(twice).link).toBe("second");
		expect(slots(run(twice, { type: "reveal" })).link).toBe("third");
	});
});

describe("received", () => {
	it("shows the notice only for a received link", () => {
		expect(slots(start)["notice-hidden"]).toBe("");
		expect(slots(initial({ ...boot, received: true }, T))["notice-hidden"]).toBeNull();
	});
});
