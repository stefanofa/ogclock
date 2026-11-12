/** @jsxRuntime automatic @jsxImportSource satori/jsx */
import { beforeAll, describe, expect, it } from "vitest";
import { clock } from "../core/calendar.ts";
import { at, CANONICAL } from "../core/fixtures.ts";
import { MINUTE, momentAt } from "../core/moment.ts";
import { PLACES } from "../core/places.ts";
import { AUTO } from "../core/tokens.ts";
import { direct, resolveTheme } from "./director.ts";
import { nodeEngine } from "./engine.node.ts";
import { fontsOf } from "./fonts.ts";
import { measure } from "./measure.node.ts";
import { textWidth } from "./metrics.ts";
import { createRenderer, type Render, sceneOf } from "./render.ts";
import { asleep, roughly } from "./themes/asleep.tsx";
import { fiveOclock, where } from "./themes/five-oclock.tsx";
import { THEMES } from "./themes/index.ts";
import { sunset } from "./themes/sunset.tsx";
import { judge } from "./themes/texting.tsx";
import { year } from "./themes/year.tsx";
import { Canvas, Mark } from "./ui.tsx";

/** Every 7th minute across a full week: about 1,440 moments, all weekdays and hours. */
const WEEK = Array.from({ length: 1440 }, (_, i) =>
	momentAt(CANONICAL.instant + i * 7 * MINUTE, CANONICAL.zone),
);

describe("registry", () => {
	it("gives every theme a unique, non-Auto wire code and id", () => {
		const codes = THEMES.map((t) => t.code);
		expect(new Set(codes).size).toBe(codes.length);
		expect(codes).not.toContain(AUTO);
		expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
	});

	it("never renumbers a theme", () => {
		expect(Object.fromEntries(THEMES.map((t) => [t.code, t.id]))).toEqual({
			1: "day-gone",
			2: "texting",
			3: "weekend",
			4: "once",
			5: "year",
			6: "sunset",
			7: "asleep",
			8: "five-oclock",
		});
	});

	it("writes a line for every minute of the week", () => {
		for (const theme of THEMES) {
			for (const m of WEEK)
				expect(theme.line(m).length, `${theme.id} at ${m.instant}`).toBeGreaterThan(10);
		}
	});
});

describe("texting", () => {
	it("has a verdict for every minute of every day", () => {
		for (const m of WEEK) expect(() => judge(m)).not.toThrow();
	});

	it("reads the room", () => {
		expect(judge(CANONICAL).verdict.line).toBe("Totally normal.");
		expect(judge(at("2026-11-12T03:12")).verdict.aside).toBe("You should be too.");
		expect(judge(at("2026-11-13T22:40")).verdict.line).toBe("It’s Friday night.");
		expect(judge(at("2026-11-14T01:30")).verdict.line).toBe("It’s Friday night.");
		expect(judge(at("2026-11-14T22:30")).verdict.line).toBe("Late.");
		expect(judge(at("2026-11-14T08:15")).verdict.line).toBe("It’s Saturday.");
	});
});

describe("year", () => {
	it("counts down in the largest unit that still fits", () => {
		expect(year.line(CANONICAL)).toBe("2026 is 86.2% complete. 50 days left.");
		expect(year.line(at("2027-01-01T00:00"))).toBe("2027 is 0.0% complete. 365 days left.");
		expect(year.line(at("2026-12-31T00:01"))).toBe("2026 is 99.7% complete. 23 hours left.");
		expect(year.line(at("2026-12-31T23:01"))).toBe("2026 is 99.99% complete. 59 minutes left.");
	});

	it("reaches halfway at noon on 2 July, or midnight in a leap year", () => {
		expect(year.line(at("2026-07-02T12:00"))).toMatch(/^2026 is 50\.0% complete\. 182 days left/);
		expect(direct(at("2026-07-02T12:00")).id).toBe("year");
		expect(direct(at("2026-07-02T12:01")).id).not.toBe("year");
		expect(direct(at("2028-07-02T00:00")).id).toBe("year");
	});
});

describe("sunset", () => {
	it("counts down to sunset, then back to sunrise", () => {
		expect(sunset.line(CANONICAL)).toBe("Sunset in 2 h 06 min.");
		expect(sunset.line(at("2026-11-11T16:24"))).toBe("Sunset in 14 min.");
		expect(sunset.line(at("2026-11-11T16:50"))).toBe("The sun set 13 min ago.");
		expect(sunset.line(at("2026-11-11T17:17"))).toBe("The sun set 40 min ago.");
		expect(sunset.line(at("2026-11-11T17:18"))).toMatch(/^Sunrise in 12 h \d\d min\.$/);
		expect(sunset.line(at("2026-11-12T05:30"))).toMatch(/^Sunrise in \d\d min\.$/);
	});

	it("says so when the sun will not cross the horizon", () => {
		expect(sunset.line(at("2026-12-21T12:00", "Antarctica/Troll"))).toBe("No sunset today.");
		expect(sunset.line(at("2026-06-21T12:00", "Antarctica/Troll"))).toBe("No sunrise today.");
	});
});

describe("asleep", () => {
	it("rounds to one significant figure", () => {
		expect(roughly(2.16e9)).toBe("2 billion");
		expect(roughly(5.7e9)).toBe("6 billion");
		expect(roughly(9.6e8)).toBe("1 billion");
		expect(roughly(8.4e8)).toBe("800 million");
	});

	it("tells night owls they are awake", () => {
		expect(asleep.line(CANONICAL)).toBe("Right now, about 2 billion people are asleep.");
		expect(asleep.line(at("2026-11-11T06:12"))).toBe(
			"Right now, about 6 billion people are asleep. You’re not one of them.",
		);
	});
});

describe("five o'clock", () => {
	it("finds a place where it is 17:00, the same one all minute", () => {
		expect(fiveOclock.line(CANONICAL)).toBe("It’s 5 o’clock in Fiji. 14:32 here.");
		expect(where(at("2026-11-11T07:48", "America/New_York"))).toBe("in the Maldives");
		expect(where(at("2026-11-11T17:05"))).toBe("right here");
	});

	it("never claims a place it is not 5 o'clock in", () => {
		for (const m of WEEK) expect(where(m)).not.toBe("somewhere");
	});
});

describe("director", () => {
	it("picks the strongest line for the moment", () => {
		expect(direct(CANONICAL).id).toBe("day-gone");
		expect(direct(at("2026-11-12T00:30")).id).toBe("texting");
		expect(direct(at("2026-11-12T03:12")).id).toBe("asleep");
		expect(direct(at("2026-11-11T16:00")).id).toBe("sunset");
		expect(direct(at("2026-11-11T15:50")).id).toBe("day-gone");
		expect(direct(at("2026-11-11T17:20")).id).toBe("five-oclock");
		expect(direct(at("2026-11-13T15:30")).id).toBe("five-oclock");
		expect(direct(at("2026-11-13T18:30")).id).toBe("weekend");
		expect(direct(at("2026-11-15T19:00")).id).toBe("weekend");
		expect(direct(at("2026-12-31T10:00")).id).toBe("year");
		expect(direct(at("2027-01-01T00:30")).id).toBe("year");
		expect(direct(at("2027-01-01T01:00")).id).toBe("texting");
		expect(direct(at("2027-01-01T00:00")).id).toBe("once");
	});

	it("respects a locked theme and ignores unknown codes", () => {
		expect(resolveTheme(4, CANONICAL).id).toBe("once");
		expect(resolveTheme(127, CANONICAL).id).toBe("day-gone");
	});
});

describe("fonts", () => {
	it("finds the faces a tree sets text in, through components", () => {
		const tree = (
			<Canvas background="#000000" style={{ fontFamily: "Archivo", fontWeight: 800 }}>
				Big
				<Mark style={{ fontWeight: 600 }} />
			</Canvas>
		);
		expect(fontsOf(tree)).toEqual(["archivo-600", "archivo-800"]);
	});

	it("refuses a face the catalog does not have", () => {
		const tree = <div style={{ fontFamily: "Archivo", fontWeight: 500 }}>x</div>;
		expect(() => fontsOf(tree)).toThrow(/Archivo 500 normal/);
	});
});

describe("render", () => {
	let render: Render;
	beforeAll(async () => {
		render = createRenderer(await nodeEngine());
	});

	it("measures text the way Satori lays it out", async () => {
		const id = "fraunces-display-500-italic";
		const phrases = PLACES.map((p) => `${p.phrase}.`);
		const laid = await measure(id, phrases, 100, -0.02);
		for (const [i, text] of phrases.entries())
			expect(textWidth(id, text, 100, -0.02), text).toBeCloseTo(laid[i] ?? 0, -1);
	});

	/** Each theme's other states: night, polar night, Friday evening, Sunday evening, New Year. */
	const STATES = [
		CANONICAL,
		at("2026-11-12T03:12"),
		at("2026-06-21T12:00", "Antarctica/Troll"),
		at("2026-11-13T17:30", "America/New_York"),
		at("2026-11-15T21:00", "Asia/Kolkata"),
		at("2027-01-01T00:00", "Pacific/Chatham"),
	];

	it.each(THEMES.map((t) => [t.id, t] as const))("%s renders a small PNG", async (_, theme) => {
		for (const m of STATES) {
			const png = await render(sceneOf(theme, m));
			const label = `${clock(m)} in ${m.zone.id}`;
			expect(String.fromCharCode(...png.subarray(1, 4)), label).toBe("PNG");
			expect(png.byteLength, label).toBeLessThan(120 * 1024);
		}
	});
});
