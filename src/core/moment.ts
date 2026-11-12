import type { Zone } from "./zone.ts";

/** ISO weekday: Monday is 1, Sunday is 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/**
 * One minute, as lived somewhere. Every theme renders from a Moment and nothing else,
 * so the same Moment always produces the same image.
 */
export interface Moment {
	/** Epoch milliseconds, floored to the minute. */
	readonly instant: number;
	readonly zone: Zone;
	readonly year: number;
	/** 1 to 12. */
	readonly month: number;
	/** 1 to 31. */
	readonly day: number;
	readonly weekday: Weekday;
	/** 0 to 23. */
	readonly hour: number;
	/** 0 to 59. */
	readonly minute: number;
	/** 0 to 1439. */
	readonly minuteOfDay: number;
}

export const MINUTE = 60_000;
export const MINUTES_PER_DAY = 1440;

const DAY = MINUTES_PER_DAY * MINUTE;

const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (zone: Zone) => {
	let formatter = formatters.get(zone.id);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: zone.id,
			hourCycle: "h23",
			year: "numeric",
			month: "numeric",
			day: "numeric",
			hour: "numeric",
			minute: "numeric",
		});
		formatters.set(zone.id, formatter);
	}
	return formatter;
};

/** Minutes east of UTC at a minute-aligned instant, as Intl reads the zone's rules. */
const readOffset = (instant: number, zone: Zone) => {
	const parts: Record<string, number> = {};
	for (const { type, value } of formatterFor(zone).formatToParts(instant))
		parts[type] = Number(value);
	const { year = 0, month = 1, day = 1, hour = 0, minute = 0 } = parts;
	// Date.UTC reads years 0 to 99 as 1900 to 1999.
	const shown = new Date(Date.UTC(2000, month - 1, day, hour, minute)).setUTCFullYear(year);
	return (shown - instant) / MINUTE;
};

/**
 * Intl is the slow part of a moment, so each zone keeps its offset for the UTC day it was last
 * asked about. No zone changes offset twice within a week, so an offset that agrees at both
 * ends of a day holds all day. On a day it changes, every minute asks Intl.
 */
const offsets = new Map<Zone, { readonly day: number; readonly offset: number | undefined }>();

const offsetAt = (instant: number, zone: Zone) => {
	const day = Math.floor(instant / DAY) * DAY;
	let known = offsets.get(zone);
	if (known?.day !== day) {
		const offset = readOffset(day, zone);
		known = { day, offset: offset === readOffset(day + DAY - MINUTE, zone) ? offset : undefined };
		offsets.set(zone, known);
	}
	return known.offset ?? readOffset(instant, zone);
};

/** The local wall-clock minute at `instant` in `zone`. DST-correct via Intl. */
export const momentAt = (instant: number, zone: Zone): Moment => {
	const floored = Math.floor(instant / MINUTE) * MINUTE;
	const local = new Date(floored + offsetAt(floored, zone) * MINUTE);
	const hour = local.getUTCHours();
	const minute = local.getUTCMinutes();
	return {
		instant: floored,
		zone,
		year: local.getUTCFullYear(),
		month: local.getUTCMonth() + 1,
		day: local.getUTCDate(),
		weekday: (local.getUTCDay() || 7) as Weekday,
		hour,
		minute,
		minuteOfDay: hour * 60 + minute,
	};
};
