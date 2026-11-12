import { dayOfYear, daysInYear } from "./calendar.ts";
import { MINUTES_PER_DAY, type Moment } from "./moment.ts";

/** A share of something, in [0, 1], with the minutes on either side of now. */
export interface Progress {
	readonly fraction: number;
	readonly elapsedMinutes: number;
	readonly remainingMinutes: number;
}

const progress = (elapsedMinutes: number, totalMinutes: number): Progress => ({
	fraction: elapsedMinutes / totalMinutes,
	elapsedMinutes,
	remainingMinutes: totalMinutes - elapsedMinutes,
});

export const dayProgress = (m: Moment): Progress => progress(m.minuteOfDay, MINUTES_PER_DAY);

export const yearProgress = (m: Moment): Progress =>
	progress(
		(dayOfYear(m) - 1) * MINUTES_PER_DAY + m.minuteOfDay,
		daysInYear(m.year) * MINUTES_PER_DAY,
	);

/**
 * A percentage for display, one decimal by default. It never reads 100 before that is
 * true: near the end it gains a decimal ("99.96"), then rounds down ("99.99").
 */
export const percent = (fraction: number, decimals = 1): string => {
	const pct = fraction * 100;
	if (pct >= 100) return (100).toFixed(decimals);
	for (const d of [decimals, decimals + 1]) {
		const rounded = pct.toFixed(d);
		if (Number(rounded) < 100) return rounded;
	}
	const scale = 10 ** (decimals + 1);
	return (Math.floor(pct * scale) / scale).toFixed(decimals + 1);
};
