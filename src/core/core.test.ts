import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { clock, dayOfYear, longDate } from "./calendar.ts";
import { bits, literal, struct, text, uint } from "./codec.ts";
import { largest, parts, plural, spoken } from "./duration.ts";
import { at, CANONICAL, zone } from "./fixtures.ts";
import { during, hours, minutesInto } from "./hours.ts";
import { momentAt } from "./moment.ts";
import { dayProgress, percent, yearProgress } from "./progress.ts";
import { altitude, isDaylight, sunDay } from "./sun.ts";
import { frame, randomNonce, share } from "./tokens.ts";
import { weekPhase } from "./week.ts";
import { UTC, zoneByCode, zoneById } from "./zone.ts";
import { ZONES } from "./zones.gen.ts";

describe("zones", () => {
	it("resolves every timezone a browser can report", () => {
		const missing = Intl.supportedValuesOf("timeZone").filter((id) => !zoneById(id));
		expect(missing).toEqual([]);
	});

	it("maps aliases to their canonical zone", () => {
		expect(zoneById("Asia/Calcutta")?.id).toBe("Asia/Kolkata");
		expect(zoneById("US/Eastern")?.id).toBe("America/New_York");
		expect(zoneById("Iceland")?.id).toBe("Atlantic/Reykjavik");
	});

	it("keeps a city's own coordinates when tzdb links its zone to another", () => {
		expect(zoneById("Atlantic/Reykjavik")).toMatchObject({ lat: 64.15, lon: -21.85 });
		expect(zoneById("Europe/Oslo")).toMatchObject({ lat: 59.92, lon: 10.75 });
		expect(zoneById("Africa/Kinshasa")).toMatchObject({ lat: -4.3, lon: 15.3 });
	});

	it("never renumbers a wire code", () => {
		expect(UTC.id).toBe("Etc/UTC");
		expect(zoneByCode(0)).toBe(UTC);
		expect(zoneByCode(1)?.id).toBe("Africa/Abidjan");
		expect(zoneByCode(105)?.id).toBe("America/New_York");
		expect(zoneByCode(213)?.id).toBe("Asia/Tokyo");
		expect(zoneByCode(246)?.id).toBe("Europe/Berlin");
	});

	it("only ever appends zone codes", () => {
		const first419 = ZONES.slice(0, 419).map(([id]) => id);
		const digest = createHash("sha256").update(first419.join("\n")).digest("hex");
		expect(digest, "zones.gen.ts reordered or renamed an existing code").toBe(
			"70c07131eb8b1db491deb9190636f42eafc41be8f5c3598b02eca5637fda7303",
		);
	});

	it("only holds zones this runtime's Intl can format", () => {
		for (const [id] of ZONES) expect(() => momentAt(CANONICAL.instant, zone(id)), id).not.toThrow();
	});
});

describe("moment", () => {
	it("reads the canonical moment", () => {
		expect(CANONICAL).toMatchObject({
			year: 2026,
			month: 11,
			day: 11,
			weekday: 3,
			hour: 14,
			minute: 32,
		});
		expect(CANONICAL.instant).toBe(Date.parse("2026-11-11T05:32:00Z"));
		expect(CANONICAL.minuteOfDay).toBe(872);
	});

	it("floors to the minute", () => {
		expect(momentAt(Date.parse("2026-11-11T05:32:59.999Z"), zone("Asia/Tokyo")).minute).toBe(32);
	});

	it("keeps years below 100", () => {
		const m = momentAt(Date.parse("0099-01-01T00:00Z"), zone("Etc/UTC"));
		expect([m.year, m.month, m.day, m.weekday]).toEqual([99, 1, 1, 4]);
	});

	it("handles 45-minute offsets", () => {
		expect(clock(momentAt(Date.parse("2026-11-11T05:32:00Z"), zone("Asia/Kathmandu")))).toBe(
			"11:17",
		);
	});

	it("follows DST across the spring-forward gap", () => {
		const ny = zone("America/New_York");
		expect(clock(momentAt(Date.parse("2026-03-08T06:59:00Z"), ny))).toBe("01:59");
		expect(clock(momentAt(Date.parse("2026-03-08T07:00:00Z"), ny))).toBe("03:00");
	});

	it("formats dates", () => {
		expect(longDate(CANONICAL)).toBe("Wednesday, 11 November 2026");
		expect(dayOfYear(CANONICAL)).toBe(315);
	});
});

describe("progress", () => {
	it("matches the designs", () => {
		expect(percent(dayProgress(CANONICAL).fraction)).toBe("60.6");
		expect(dayProgress(CANONICAL).remainingMinutes).toBe(568);
		expect(percent(yearProgress(CANONICAL).fraction)).toBe("86.2");
	});

	it("never claims 100% before it is true", () => {
		expect(percent(yearProgress(at("2026-12-31T23:59")).fraction)).toBe("99.99");
		expect(percent(dayProgress(at("2026-11-11T23:59")).fraction)).toBe("99.9");
	});
});

describe("week", () => {
	it("counts down to the weekend on weekdays", () => {
		const phase = weekPhase(CANONICAL);
		expect(phase.kind).toBe("weekday");
		if (phase.kind === "weekday")
			expect(spoken(phase.untilWeekend)).toBe("2 days, 9 hours, 28 minutes");
	});

	it("turns to Monday on Sunday afternoon", () => {
		const phase = weekPhase(at("2026-11-15T15:00"));
		expect(phase).toEqual({ kind: "sunday-evening", untilMonday: 540 });
	});

	it("enjoys the weekend on Saturday", () => {
		expect(weekPhase(at("2026-11-14T10:00")).kind).toBe("weekend");
	});
});

describe("hours", () => {
	it("runs past midnight, belonging to the day it opens", () => {
		const fridayNight = during("22:00-02:00", [5]);
		expect(fridayNight(at("2026-11-13T23:30"))).toBe(true);
		expect(fridayNight(at("2026-11-14T01:59"))).toBe(true);
		expect(fridayNight(at("2026-11-14T02:00"))).toBe(false);
		expect(fridayNight(at("2026-11-14T22:30"))).toBe(false);
		expect(fridayNight(at("2026-11-13T01:00"))).toBe(false);
	});

	it("counts the minutes since it opened", () => {
		expect(minutesInto(hours("22:00-02:00"), at("2026-11-14T01:00"))).toBe(180);
		expect(minutesInto(hours("23:00-24:00"), at("2026-11-14T22:59"))).toBeUndefined();
		expect(hours("00:00-24:00").length).toBe(1440);
	});
});

describe("duration", () => {
	it("speaks a span in days, hours and minutes", () => {
		expect(spoken(61)).toBe("1 hour, 1 minute");
		expect(spoken(0)).toBe("0 minutes");
	});

	it("counts in the units asked for", () => {
		expect(parts(1500, ["hour", "minute"])).toEqual([
			[25, "hour"],
			[0, "minute"],
		]);
		expect(parts(126, ["day", "hour", "minute"])).toEqual([
			[0, "day"],
			[2, "hour"],
			[6, "minute"],
		]);
	});

	it("rounds down to the largest unit the span fills", () => {
		const said = (minutes: number) => plural(...largest(minutes));
		expect(said(1441)).toBe("1 day");
		expect(said(1439)).toBe("23 hours");
		expect(said(60)).toBe("1 hour");
		expect(said(59)).toBe("59 minutes");
		expect(said(1)).toBe("1 minute");
	});
});

describe("codec", () => {
	const point = text(struct({ v: literal(uint(2), 1), x: uint(9), y: bits(20) }));

	it("round-trips", () => {
		const value = { v: 1 as const, x: 300, y: 0xabcden };
		expect(point.decode(point.encode(value))).toEqual(value);
		expect(point.length).toBe(7);
	});

	it("rejects anything encode could not have produced", () => {
		const good = point.encode({ v: 1, x: 3, y: 5n });
		expect(point.decode(good.toUpperCase())).toBeUndefined();
		expect(point.decode(`${good}0`)).toBeUndefined();
		expect(point.decode("zzzzzzz")).toBeUndefined();
		expect(point.decode(good.replace(/^./, "l"))).toBeUndefined();
	});

	it("refuses values that do not fit", () => {
		expect(() => point.encode({ v: 1, x: 512, y: 0n })).toThrow(RangeError);
	});
});

describe("tokens", () => {
	it("reads tokens already shared", () => {
		const link = { zone: zone("Asia/Tokyo"), theme: 3, nonce: 0x2_c0ff_ee12_3456n };
		expect(share.decode("09n83p0zzq14d2p")).toEqual(link);
		expect(share.encode(link)).toBe("09n83p0zzq14d2p");

		const still = {
			theme: 6,
			instant: Date.parse("2026-11-11T05:32:00Z"),
			zone: zone("Europe/London"),
		};
		expect(frame.decode("0grwgnac83")).toEqual(still);
		expect(frame.encode(still)).toBe("0grwgnac83");
	});

	it("round-trips a share link", () => {
		const value = { zone: zone("Asia/Tokyo"), theme: 3, nonce: randomNonce() };
		const token = share.encode(value);
		expect(token).toHaveLength(15);
		expect(share.decode(token)).toEqual(value);
	});

	it("round-trips an image frame", () => {
		const value = { theme: 1, instant: CANONICAL.instant, zone: CANONICAL.zone };
		const token = frame.encode(value);
		expect(token).toHaveLength(10);
		expect(frame.decode(token)).toEqual(value);
	});

	it("rejects unknown zones", () => {
		const token = share.encode({ zone: zone("Asia/Tokyo"), theme: 0, nonce: 0n });
		const forged = `${token.slice(0, 1)}zz${token.slice(3)}`;
		expect(share.decode(forged)).toBeUndefined();
	});
});

describe("sun", () => {
	const tokyo = CANONICAL.zone;

	it("puts Tokyo's sunset near 16:38 on 11 November", () => {
		const day = sunDay(CANONICAL.instant, tokyo.lat, tokyo.lon);
		expect(day.kind).toBe("normal");
		if (day.kind !== "normal") return;
		expect(clock(momentAt(day.sunset, tokyo))).toMatch(/^16:3[6-9]$/);
		expect(clock(momentAt(day.sunrise, tokyo))).toMatch(/^06:(0[7-9]|1[0-4])$/);
	});

	it("knows day from night", () => {
		expect(isDaylight(CANONICAL)).toBe(true);
		expect(isDaylight(at("2026-11-11T03:12"))).toBe(false);
		expect(altitude(CANONICAL.instant, tokyo.lat, tokyo.lon)).toBeGreaterThan(15);
	});

	it("handles the poles", () => {
		expect(sunDay(Date.parse("2026-06-21T12:00Z"), 78, 15).kind).toBe("polar-day");
		expect(sunDay(Date.parse("2026-12-21T12:00Z"), 78, 15).kind).toBe("polar-night");
	});
});
