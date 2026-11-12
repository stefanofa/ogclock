/** The units a span is said in, and the minutes in each. */
const MINUTES_IN = { day: 1440, hour: 60, minute: 1 } as const;

export type Unit = keyof typeof MINUTES_IN;

const SPOKEN = ["day", "hour", "minute"] as const;

/** "1 hour", "28 minutes". */
export const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/**
 * A whole-minute span counted out in `units`, largest first, as [count, unit] pairs. Whatever
 * the last unit cannot hold is dropped: 1,500 minutes in hours is [[25, "hour"]].
 */
export const parts = <const U extends readonly Unit[]>(minutes: number, units: U) => {
	let rest = Math.max(0, Math.round(minutes));
	return units.map((unit) => {
		const count = Math.floor(rest / MINUTES_IN[unit]);
		rest -= count * MINUTES_IN[unit];
		return [count, unit];
	}) as { readonly [K in keyof U]: readonly [count: number, unit: U[K]] };
};

/** The largest unit the span fills, rounded down: 1,441 minutes is [1, "day"]. */
export const largest = (minutes: number): readonly [count: number, unit: Unit] =>
	parts(minutes, SPOKEN).find(([count]) => count > 0) ?? [0, "minute"];

/** "2 days, 9 hours, 28 minutes". Zero units are dropped; zero overall is "0 minutes". */
export const spoken = (minutes: number): string =>
	parts(minutes, SPOKEN)
		.filter(([count]) => count > 0)
		.map(([count, unit]) => plural(count, unit))
		.join(", ") || plural(0, "minute");
