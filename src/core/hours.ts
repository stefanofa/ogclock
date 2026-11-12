import { MINUTES_PER_DAY, type Moment, type Weekday } from "./moment.ts";

/**
 * A stretch of local time, open `length` minutes from `from` (a minute of the day). It opens
 * on `days`, or every day when there are none, and may run past midnight into the next day.
 */
export interface Hours {
	readonly from: number;
	readonly length: number;
	readonly days?: readonly Weekday[];
}

const minuteOf = (time: string) => {
	const [h = 0, m = 0] = time.split(":").map(Number);
	return h * 60 + m;
};

/** "22:00-02:00" on Friday holds Saturday 01:00. "00:00-24:00" is the whole day. */
export const hours = (span: string, days?: readonly Weekday[]): Hours => {
	const [from = 0, to = 0] = span.split("-").map(minuteOf);
	const length = (to - from + MINUTES_PER_DAY) % MINUTES_PER_DAY || MINUTES_PER_DAY;
	return { from, length, ...(days && { days }) };
};

const dayBefore = (day: Weekday) => (((day + 5) % 7) + 1) as Weekday;

/** Minutes since `h` opened, or undefined when `m` falls outside it. */
export const minutesInto = (h: Hours, m: Moment): number | undefined => {
	const since = (m.minuteOfDay - h.from + MINUTES_PER_DAY) % MINUTES_PER_DAY;
	const opened = since > m.minuteOfDay ? dayBefore(m.weekday) : m.weekday;
	return since < h.length && (!h.days || h.days.includes(opened)) ? since : undefined;
};

/** Whether a moment falls in a stretch of local time: during("23:00-02:00"). */
export const during = (span: string, days?: readonly Weekday[]) => {
	const h = hours(span, days);
	return (m: Moment) => minutesInto(h, m) !== undefined;
};
