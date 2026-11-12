import { MINUTES_PER_DAY, type Moment, type Weekday } from "./moment.ts";

const WEEKDAY_NAMES: Readonly<Record<Weekday, string>> = {
	1: "Monday",
	2: "Tuesday",
	3: "Wednesday",
	4: "Thursday",
	5: "Friday",
	6: "Saturday",
	7: "Sunday",
};

const MONTH_NAMES = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
] as const;

const isLeapYear = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

export const daysInYear = (year: number) => (isLeapYear(year) ? 366 : 365);

/** 1 on 1 January. */
export const dayOfYear = ({ year, month, day }: Pick<Moment, "year" | "month" | "day">) =>
	(Date.UTC(year, month - 1, day) - Date.UTC(year, 0, 1)) / (MINUTES_PER_DAY * 60_000) + 1;

export const monthName = (m: Pick<Moment, "month">) => MONTH_NAMES[m.month - 1] ?? "";

export const weekdayName = (m: Pick<Moment, "weekday">) => WEEKDAY_NAMES[m.weekday];

/** "14:32" */
export const clock = ({ hour, minute }: Pick<Moment, "hour" | "minute">) =>
	`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;

/** "Wednesday, 11 November 2026" */
export const longDate = (m: Moment) => `${weekdayName(m)}, ${m.day} ${monthName(m)} ${m.year}`;
