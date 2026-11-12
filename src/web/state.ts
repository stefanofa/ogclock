import { MINUTE } from "../core/moment.ts";
import { AUTO } from "../core/tokens.ts";
import type { Boot, Look, Minute, Now } from "./protocol.ts";

/**
 * The page as data. Pure: the reducer never reads the clock, the network or the DOM.
 * Anything random or timed (minting links, the clock) arrives inside an Action.
 */

/** The copy button's label. Every copy restarts the cycle, keyed by its count. */
export type Copy = "idle" | "copied";

export interface State {
	readonly host: string;
	readonly zone: number;
	/** Chosen theme code; AUTO lets the director pick each minute. */
	readonly theme: number;
	/** The share token the next copy or share hands out, and the one in the address bar. */
	readonly link: string;
	/** The link just handed out. The slug shows it for a beat, so the eye catches the swap. */
	readonly sent: string | undefined;
	readonly minute: Minute;
	/** Undefined while it is being fetched. */
	readonly next: Minute | undefined;
	/** The last tick on the server's clock, epoch milliseconds. */
	readonly clock: number;
	/** Server clock minus this device's, measured at boot. Ticks carry the device's clock. */
	readonly offset: number;
	readonly copy: Copy;
	/** How many copies so far; timers carry it so a stale one cannot end a newer copy. */
	readonly copies: number;
	readonly toast: boolean;
	readonly sheet: boolean;
	readonly received: boolean;
}

export type Action =
	| { readonly type: "tick"; readonly now: number }
	| { readonly type: "now"; readonly now: Now }
	| { readonly type: "theme"; readonly theme: number; readonly link: string }
	| { readonly type: "link"; readonly link: string }
	| { readonly type: "sent"; readonly link: string }
	| { readonly type: "reveal" }
	| { readonly type: "copied" }
	| { readonly type: "settle"; readonly copy: number }
	| { readonly type: "dismiss"; readonly copy: number }
	| { readonly type: "sheet"; readonly open: boolean };

/** `device` is this device's clock at the moment the server read boot.serverNow. */
export const initial = (boot: Boot, device: number): State => ({
	host: boot.host,
	zone: boot.zone,
	theme: boot.theme,
	link: boot.link,
	sent: undefined,
	minute: boot.now.minute,
	next: boot.now.next,
	clock: boot.serverNow,
	offset: boot.serverNow - device,
	copy: "idle",
	copies: 0,
	toast: false,
	sheet: false,
	received: boot.received,
});

/** Moves to the next minute once the clock crosses it. A tab that slept longer refetches. */
const tick = (s: State, device: number): State => {
	const now = device + s.offset;
	if (!s.next || now < s.next.instant) return { ...s, clock: now };
	if (now < s.next.instant + MINUTE) return { ...s, clock: now, minute: s.next, next: undefined };
	return { ...s, clock: now, next: undefined };
};

export const reduce = (s: State, a: Action): State => {
	switch (a.type) {
		case "tick":
			return tick(s, a.now);
		case "now":
			// An edge cache can answer with the minute that just ended: keep what is newer.
			return a.now.minute.instant < s.minute.instant
				? s
				: { ...s, minute: a.now.minute, next: a.now.next };
		case "theme":
			return { ...s, theme: a.theme, link: a.link, sent: undefined };
		case "link":
			return { ...s, link: a.link, sent: undefined };
		case "sent":
			return { ...s, link: a.link, sent: s.link };
		case "reveal":
			return { ...s, sent: undefined };
		case "copied":
			return { ...s, copy: "copied", copies: s.copies + 1, toast: true };
		case "settle":
			return a.copy === s.copies ? { ...s, copy: "idle" } : s;
		case "dismiss":
			return a.copy === s.copies ? { ...s, toast: false } : s;
		case "sheet":
			return { ...s, sheet: a.open };
	}
};

const lookOf = (m: Minute, code: number): Look | undefined =>
	m.themes.find((look) => look.code === code);

/** What the link would show if pasted now. */
export const shown = (s: State): Look => {
	const look =
		lookOf(s.minute, s.theme === AUTO ? s.minute.auto : s.theme) ??
		lookOf(s.minute, s.minute.auto) ??
		s.minute.themes[0];
	if (!look) throw new Error("a minute without looks");
	return look;
};

/** Whole seconds until the minute turns, 60 down to 1. */
export const secondsLeft = (s: State) =>
	Math.min(60, Math.max(1, Math.ceil((s.minute.instant + MINUTE - s.clock) / 1000)));

/** Fraction of the current minute already gone. */
export const elapsed = (s: State) =>
	Math.min(1, Math.max(0, (s.clock - s.minute.instant) / MINUTE));
