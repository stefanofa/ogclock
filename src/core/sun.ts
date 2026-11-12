import type { Moment } from "./moment.ts";

/** Low-precision solar ephemeris (NOAA's approximation), good to about a minute. */

const RAD = Math.PI / 180;
const DAY = 86_400_000;
/** The sun's upper limb touches the horizon, refraction included. */
export const HORIZON = -0.833;

const solar = (instant: number) => {
	const n = instant / DAY + 2440587.5 - 2451545.0;
	const meanLongitude = (280.46 + 0.9856474 * n) % 360;
	const anomaly = ((357.528 + 0.9856003 * n) % 360) * RAD;
	const longitude =
		(meanLongitude + 1.915 * Math.sin(anomaly) + 0.02 * Math.sin(2 * anomaly)) * RAD;
	const obliquity = (23.439 - 0.0000004 * n) * RAD;
	const declination = Math.asin(Math.sin(obliquity) * Math.sin(longitude));
	const rightAscension =
		Math.atan2(Math.cos(obliquity) * Math.sin(longitude), Math.cos(longitude)) / RAD;
	const equationOfTime = (((meanLongitude - rightAscension + 540) % 360) - 180) * 4;
	return { declination, equationOfTime };
};

/** Degrees above the horizon at `instant` for an observer at lat/lon. */
export const altitude = (instant: number, lat: number, lon: number): number => {
	const { declination, equationOfTime } = solar(instant);
	const utcMinutes = (((instant % DAY) + DAY) % DAY) / 60_000;
	const hourAngle = ((utcMinutes + equationOfTime + 4 * lon) / 4 - 180) * RAD;
	const phi = lat * RAD;
	return (
		Math.asin(
			Math.sin(phi) * Math.sin(declination) +
				Math.cos(phi) * Math.cos(declination) * Math.cos(hourAngle),
		) / RAD
	);
};

export type SunDay =
	| { readonly kind: "normal"; readonly sunrise: number; readonly sunset: number }
	| { readonly kind: "polar-day" }
	| { readonly kind: "polar-night" };

/** Sunrise and sunset (epoch ms) for the UTC day containing `instant`, at lat/lon. */
export const sunDay = (instant: number, lat: number, lon: number): SunDay => {
	const midnight = Math.floor(instant / DAY) * DAY;
	const noonGuess = midnight + (720 - 4 * lon) * 60_000;
	const { declination, equationOfTime } = solar(noonGuess);
	const phi = lat * RAD;
	const cosH =
		(Math.sin(HORIZON * RAD) - Math.sin(phi) * Math.sin(declination)) /
		(Math.cos(phi) * Math.cos(declination));
	if (cosH < -1) return { kind: "polar-day" };
	if (cosH > 1) return { kind: "polar-night" };
	const noon = midnight + (720 - 4 * lon - equationOfTime) * 60_000;
	const halfDay = (Math.acos(cosH) / RAD) * 4 * 60_000;
	return { kind: "normal", sunrise: noon - halfDay, sunset: noon + halfDay };
};

/** Whether the sun is up where the moment's zone is. */
export const isDaylight = (m: Moment) => altitude(m.instant, m.zone.lat, m.zone.lon) > HORIZON;

/** Where the sun is overhead at `instant`, in degrees. */
export const subsolarPoint = (instant: number): { readonly lat: number; readonly lon: number } => {
	const { declination, equationOfTime } = solar(instant);
	const utcMinutes = (((instant % DAY) + DAY) % DAY) / 60_000;
	const lon = (720 - utcMinutes - equationOfTime) / 4;
	return { lat: declination / RAD, lon: ((((lon + 180) % 360) + 360) % 360) - 180 };
};

/**
 * The sun's state at an instant. A day knows its coming sunset, a night its coming sunrise;
 * the crossing behind may be missing at the edge of a polar day or night.
 */
export type SunPhase =
	| { readonly kind: "day"; readonly sunrise?: number; readonly sunset: number }
	| { readonly kind: "night"; readonly sunset?: number; readonly sunrise: number }
	| { readonly kind: "polar-day" }
	| { readonly kind: "polar-night" };

/** The horizon crossings on either side of `instant`, and which one came last. */
export const sunPhase = (instant: number, lat: number, lon: number): SunPhase => {
	const days = [-DAY, 0, DAY].flatMap((offset) => {
		const day = sunDay(instant + offset, lat, lon);
		return day.kind === "normal" ? [day] : [];
	});
	const rises = days.map((d) => d.sunrise);
	const sets = days.map((d) => d.sunset);
	const lastOf = (ts: number[]) => ts.filter((t) => t <= instant).at(-1);
	const nextOf = (ts: number[]) => ts.find((t) => t > instant);
	const [lastRise, lastSet] = [lastOf(rises), lastOf(sets)];

	const up =
		lastRise === undefined && lastSet === undefined
			? altitude(instant, lat, lon) > HORIZON
			: (lastRise ?? -Infinity) > (lastSet ?? -Infinity);
	if (up) {
		const sunset = nextOf(sets);
		if (sunset === undefined) return { kind: "polar-day" };
		return { kind: "day", sunset, ...(lastRise !== undefined && { sunrise: lastRise }) };
	}
	const sunrise = nextOf(rises);
	if (sunrise === undefined) return { kind: "polar-night" };
	return { kind: "night", sunrise, ...(lastSet !== undefined && { sunset: lastSet }) };
};
