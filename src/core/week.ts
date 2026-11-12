import { MINUTES_PER_DAY, type Moment } from "./moment.ts";

/** Where a moment sits in the working week. */
export type WeekPhase =
	| { readonly kind: "weekday"; readonly untilWeekend: number }
	| { readonly kind: "weekend"; readonly weekendLeft: number }
	| { readonly kind: "sunday-evening"; readonly untilMonday: number };

const WEEK = 7 * MINUTES_PER_DAY;

/** Minutes since Monday 00:00 local time. */
export const minuteOfWeek = (m: Moment) => (m.weekday - 1) * MINUTES_PER_DAY + m.minuteOfDay;

const SATURDAY = 5 * MINUTES_PER_DAY;
const SUNDAY_NOON = 6 * MINUTES_PER_DAY + 720;

export const weekPhase = (m: Moment): WeekPhase => {
	const now = minuteOfWeek(m);
	if (now < SATURDAY) return { kind: "weekday", untilWeekend: SATURDAY - now };
	if (now < SUNDAY_NOON) return { kind: "weekend", weekendLeft: WEEK - now };
	return { kind: "sunday-evening", untilMonday: WEEK - now };
};
