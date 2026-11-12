import { describe, expect, it } from "vitest";
import { clock } from "./calendar.ts";
import { at, CANONICAL, zone } from "./fixtures.ts";
import { MINUTE, momentAt } from "./moment.ts";
import { PLACES, placesAtHour } from "./places.ts";
import { asleepShare, peopleAsleep, WORLD_POPULATION } from "./population.ts";
import { altitude, subsolarPoint, sunPhase } from "./sun.ts";
import { darkness, elevation } from "./terminator.ts";
import type { Zone } from "./zone.ts";
import { ZONES } from "./zones.gen.ts";

const phaseAt = (local: string, zoneId = "Asia/Tokyo") => {
	const m = at(local, zoneId);
	return { m, phase: sunPhase(m.instant, m.zone.lat, m.zone.lon) };
};

describe("sun phase", () => {
	it("knows the coming sunset by day", () => {
		const { m, phase } = phaseAt("2026-11-11T14:32");
		expect(phase.kind).toBe("day");
		if (phase.kind !== "day") return;
		expect(clock(momentAt(phase.sunset, m.zone))).toBe("16:37");
		expect(clock(momentAt(phase.sunrise ?? 0, m.zone))).toBe("06:12");
	});

	it("finds today's sunset when the local morning is still yesterday in UTC", () => {
		const { m, phase } = phaseAt("2026-11-11T08:00");
		expect(phase.kind).toBe("day");
		if (phase.kind === "day") expect(momentAt(phase.sunset, m.zone).day).toBe(11);
	});

	it("knows the last sunset and the next sunrise by night", () => {
		const { m, phase } = phaseAt("2026-11-11T20:00");
		expect(phase.kind).toBe("night");
		if (phase.kind !== "night") return;
		expect(momentAt(phase.sunrise, m.zone)).toMatchObject({ day: 12, hour: 6 });
		expect(momentAt(phase.sunset ?? 0, m.zone)).toMatchObject({ day: 11, hour: 16 });
	});

	it("handles polar day and night", () => {
		expect(phaseAt("2026-12-21T12:00", "Antarctica/Troll").phase.kind).toBe("polar-day");
		expect(phaseAt("2026-06-21T12:00", "Antarctica/Troll").phase.kind).toBe("polar-night");
	});
});

describe("terminator", () => {
	const sub = subsolarPoint(CANONICAL.instant);

	it("puts the sun overhead in the southern tropics in November", () => {
		expect(sub.lat).toBeCloseTo(-17.5, 0);
		expect(elevation(sub, sub.lat, sub.lon)).toBeCloseTo(90, 5);
	});

	it("agrees with the observer's altitude everywhere", () => {
		for (const [lat, lon] of [
			[35.65, 139.73],
			[-33.9, 18.4],
			[64.1, -21.9],
			[0, -170],
		] as const)
			expect(elevation(sub, lat, lon)).toBeCloseTo(altitude(CANONICAL.instant, lat, lon), 6);
	});

	const encloses = (ring: readonly (readonly [number, number])[], x: number, y: number) =>
		ring.reduce((odd, [x1, y1], i) => {
			const [x0, y0] = ring.at(i - 1) ?? [x1, y1];
			return y0 > y !== y1 > y && x < x0 + ((x1 - x0) * (y - y0)) / (y1 - y0) ? !odd : odd;
		}, false);

	const darkAt = (instant: number, below: number) => {
		const { edge, pole } = darkness(instant, below);
		const poleLat = pole === "north" ? 90 : -90;
		const ends = [edge.at(-1), edge[0]].map((p) => [p?.[0] ?? 0, poleLat] as const);
		const ring = pole ? [...edge, ...ends] : edge;
		return (lat: number, lon: number) =>
			[lon - 360, lon, lon + 360].some((x) => encloses(ring, x, lat));
	};

	const grid = Array.from(
		{ length: 41 * 90 },
		(_, i) => [-80 + 4 * Math.floor(i / 90), -180 + 4 * (i % 90)] as const,
	);

	it.each([
		"2026-03-25T03:00Z",
		"2026-03-25T12:00Z",
		"2026-06-21T03:00Z",
		"2026-09-23T03:00Z",
		"2026-10-15T20:00Z",
		"2026-11-11T05:32Z",
		"2026-12-21T03:00Z",
	])("shades where the sun is below the horizon, civil and nautical dusk at %s", (iso) => {
		const instant = Date.parse(iso);
		const sun = subsolarPoint(instant);
		const wrong = [0, -6, -12].flatMap((below) => {
			const dark = darkAt(instant, below);
			return grid
				.filter(([lat, lon]) => {
					const e = elevation(sun, lat, lon);
					return Math.abs(e - below) > 0.5 && dark(lat, lon) !== e < below;
				})
				.map(([lat, lon]) => `${below}° at ${lat},${lon}`);
		});
		expect(wrong.length, wrong.slice(0, 3).join("; ")).toBe(0);
	});
});

describe("population", () => {
	it("eases into and out of the night", () => {
		expect(asleepShare(12 * 60)).toBe(0);
		expect(asleepShare(22 * 60 + 30)).toBe(0);
		expect(asleepShare(23 * 60)).toBe(0.5);
		expect(asleepShare(3 * 60)).toBe(1);
		expect(asleepShare(7 * 60)).toBe(0.5);
		expect(asleepShare(7 * 60 + 30)).toBe(0);
	});

	it("counts about eight billion people", () => {
		expect(WORLD_POPULATION).toBeGreaterThan(7.9e9);
		expect(WORLD_POPULATION).toBeLessThan(8.4e9);
	});

	it("matches the designs", () => {
		expect(peopleAsleep(CANONICAL.instant) / 1e9).toBeCloseTo(2.2, 1);
		expect(peopleAsleep(at("2026-11-11T06:12").instant) / 1e9).toBeCloseTo(5.7, 1);
	});

	it("moves without jumps", () => {
		const day = Array.from({ length: 1440 }, (_, i) =>
			peopleAsleep(CANONICAL.instant + i * MINUTE),
		);
		const steps = day.slice(1).map((n, i) => Math.abs(n - (day[i] ?? n)));
		expect(Math.max(...steps)).toBeLessThan(0.05e9);
	});
});

describe("places", () => {
	/** Minutes east of UTC on a given day. Mid-January and mid-July cross no DST change. */
	const offsetOf = (z: Zone, instant: number) => {
		const m = momentAt(instant, z);
		return Math.round((Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute) - instant) / MINUTE);
	};
	const zones = ZONES.map(([id]) => zone(id));

	it.each(["2026-01-15", "2026-07-15"])(
		"has a place at 17:00 for every offset in use, every minute of %s",
		(day) => {
			const midnight = Date.parse(`${day}T00:00Z`);
			const inUse = new Set(zones.map((z) => offsetOf(z, midnight + 720 * MINUTE)));
			for (let minute = 0; minute < 1440; minute++) {
				const instant = midnight + minute * MINUTE;
				const covered = new Set(placesAtHour(instant, 17).map((p) => offsetOf(p.zone, instant)));
				for (const offset of inUse) {
					const local = (((minute + offset) % 1440) + 1440) % 1440;
					if (Math.floor(local / 60) === 17)
						expect(covered.has(offset), `UTC+${offset / 60} at ${minute}`).toBe(true);
				}
			}
		},
	);

	it("is honest about the hour", () => {
		for (const place of placesAtHour(CANONICAL.instant, 17))
			expect(momentAt(CANONICAL.instant, place.zone).hour).toBe(17);
		expect(placesAtHour(CANONICAL.instant, 17).map((p) => p.phrase)).toContain("in Fiji");
		expect(PLACES.every((p) => /^(in|on) /.test(p.phrase))).toBe(true);
		expect(new Set(PLACES.map((p) => p.phrase)).size).toBe(PLACES.length);
		expect(zone("Pacific/Fiji")).toBe(PLACES.find((p) => p.phrase === "in Fiji")?.zone);
	});
});
