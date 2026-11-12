import { bits, literal, map, struct, text, uint } from "./codec.ts";
import { MINUTE } from "./moment.ts";
import { type Zone, zoneByCode } from "./zone.ts";

/**
 * The two public identifiers. A share token names a clock (whose time is read when a
 * platform fetches it); an image token names one rendered minute and never changes.
 */

const zone = map(uint(10), zoneByCode, (z: Zone) => z.code);

/** Theme wire codes. 0 means "let the director choose". */
const theme = uint(7);

export const AUTO = 0;

export interface Share {
	readonly zone: Zone;
	readonly theme: number;
	/** Makes every copied link new to platform caches. 50 random bits. */
	readonly nonce: bigint;
}

export const share = text(
	map(
		struct({
			version: literal(uint(3), 1),
			zone,
			/** Reserved for the opt-in place label. Always 0 until it ships. */
			place: literal(uint(1), 0),
			theme,
			nonce: bits(50),
		}),
		({ zone, theme, nonce }): Share => ({ zone, theme, nonce }),
		(s) => ({ version: 1 as const, place: 0 as const, ...s }),
	),
);

export interface Frame {
	readonly theme: number;
	/** Epoch milliseconds, on a minute boundary. */
	readonly instant: number;
	readonly zone: Zone;
}

export const frame = text(
	map(
		struct({
			version: literal(uint(3), 1),
			theme,
			/** Epoch minutes: 27 bits lasts until the 2220s. */
			minute: uint(27),
			zone,
		}),
		({ theme, minute, zone }): Frame => ({ theme, instant: minute * MINUTE, zone }),
		(f) => ({
			version: 1 as const,
			theme: f.theme,
			minute: Math.floor(f.instant / MINUTE),
			zone: f.zone,
		}),
	),
);

/** 50 bits from the platform CSPRNG. Works in Workers, browsers and Node. */
export const randomNonce = (): bigint => {
	const bytes = crypto.getRandomValues(new Uint8Array(7));
	return bytes.reduce((n, byte) => (n << 8n) | BigInt(byte), 0n) >> 6n;
};
