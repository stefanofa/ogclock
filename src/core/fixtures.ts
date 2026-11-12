import { momentAt } from "./moment.ts";
import { type Zone, zoneById } from "./zone.ts";

export const zone = (id: string): Zone => {
	const z = zoneById(id);
	if (!z) throw new Error(`unknown zone ${id}`);
	return z;
};

/** A moment from a local wall-clock reading, for tests: at("2026-11-11T14:32", "Asia/Tokyo"). */
export const at = (local: string, zoneId = "Asia/Tokyo") => {
	const z = zone(zoneId);
	const guess = Date.parse(`${local}:00Z`);
	// Walk the guess by the zone's offset until the wall clock matches. Two steps cover DST.
	let instant = guess;
	for (let i = 0; i < 3; i++) {
		const m = momentAt(instant, z);
		const shown = Date.UTC(m.year, m.month - 1, m.day, m.hour, m.minute);
		instant += guess - shown;
	}
	return momentAt(instant, z);
};

/** The canonical moment every design shows: Wednesday 11 November 2026, 14:32 in Tokyo. */
export const CANONICAL = at("2026-11-11T14:32");
