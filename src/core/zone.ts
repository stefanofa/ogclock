import { ALIASES, ZONES } from "./zones.gen.ts";

/** An IANA timezone the product knows. `code` is its stable wire code inside links. */
export interface Zone {
	readonly code: number;
	readonly id: string;
	/** Representative coordinates from tzdb, used for sun maths. Never displayed. */
	readonly lat: number;
	readonly lon: number;
}

const zones: readonly Zone[] = ZONES.map(([id, lat, lon], code) => ({ code, id, lat, lon }));
const byId = new Map(zones.map((zone) => [zone.id, zone]));

export const UTC: Zone = zones[0] as Zone;

export const zoneByCode = (code: number): Zone | undefined => zones[code];

/** Accepts canonical ids and tzdb aliases ("Asia/Calcutta", "US/Pacific"). */
export const zoneById = (id: string): Zone | undefined => byId.get(ALIASES[id] ?? id);
