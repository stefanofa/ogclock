import { randomNonce, share } from "../core/tokens.ts";
import { UTC, zoneByCode, zoneById } from "../core/zone.ts";

/** A share token no platform has seen. Minted in the browser, so Copy never waits. */
export const mint = (zone: number, theme: number) =>
	share.encode({ zone: zoneByCode(zone) ?? UTC, theme, nonce: randomNonce() });

/** The zone code for an IANA id, or the fallback for an id the table does not know. */
export const zoneCode = (id: string, fallback: number) => zoneById(id)?.code ?? fallback;
