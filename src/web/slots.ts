import { clock } from "../core/calendar.ts";
import { MINUTE, momentAt } from "../core/moment.ts";
import { AUTO } from "../core/tokens.ts";
import { UTC, zoneByCode } from "../core/zone.ts";
import { elapsed, type State, secondsLeft, shown } from "./state.ts";

/**
 * Everything on the page that depends on State, as named strings. The Worker writes them
 * into the shell for first paint and the browser patches them after, from the same function.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** "0:28" */
const countdown = (seconds: number) => `${Math.floor(seconds / 60)}:${pad(seconds % 60)}`;

/** Slot keys for one theme's tile. Auto is code 0. */
export const tileSlots = (code: number) =>
	({ checked: `checked-${code}`, tab: `tab-${code}`, thumb: `thumb-${code}` }) as const;

type TileSlot = ReturnType<typeof tileSlots>[keyof ReturnType<typeof tileSlots>];

export const slots = (s: State) => {
	const look = shown(s);
	const zone = zoneByCode(s.minute.zone) ?? UTC;
	const time = clock(momentAt(s.minute.instant, zone));
	const tiles: Record<TileSlot, string> = {};
	for (const code of [AUTO, ...s.minute.themes.map((theme) => theme.code)]) {
		const keys = tileSlots(code);
		tiles[keys.checked] = String(code === s.theme);
		tiles[keys.tab] = code === s.theme ? "0" : "-1";
	}
	for (const theme of s.minute.themes) tiles[tileSlots(theme.code).thumb] = theme.image;

	return {
		...tiles,
		host: s.host,
		link: s.sent ?? s.link,
		time,
		next: clock(momentAt(s.minute.instant + MINUTE, zone)),
		left: countdown(secondsLeft(s)),
		/** Meter fill for first paint and reduced motion; the browser animates it otherwise. */
		done: `--done:${elapsed(s).toFixed(3)}`,
		line: look.line,
		image: look.image,
		choice: s.theme === AUTO ? "Auto" : look.name,
		"notice-hidden": s.received ? null : "",
		copy: s.copy,
		toast: s.toast ? "shown" : "hidden",
		sheet: s.sheet ? "open" : "closed",
		announce: s.copy === "copied" ? `Copied. Paste it now and they'll see ${time}.` : "",
	};
};

export type Slots = ReturnType<typeof slots>;

/** What binding a slot needs from an element. The Worker and the browser each adapt theirs. */
export interface Target {
	readonly get: (attribute: string) => string | null;
	/** null removes the attribute. */
	readonly set: (attribute: string, value: string | null) => void;
	readonly text: (value: string) => void;
	/** An <img> source. The browser crossfades to it over `fade` milliseconds. */
	readonly image: (src: string, fade: number) => void;
}

export type Write = (value: string | null, fade: number) => void;

type Binding = readonly [key: string, write: Write];

const KEY = /^[a-z0-9-]+$/;

const malformed = (spec: string): never => {
	throw new Error(`malformed slot binding "${spec}"`);
};

const key = (spec: string) => (KEY.test(spec) ? spec : malformed(spec));

/**
 * How the shell marks where each slot goes:
 *   data-text="time"                           element text
 *   data-attr="hidden=notice-hidden alt=line"  attributes; null removes the attribute
 *   data-fade="image"                          an <img> src, crossfaded in the browser
 */
const DIRECTIVES: Readonly<Record<string, (spec: string, el: Target) => Binding[]>> = {
	"data-text": (spec, el) => [[key(spec), (value) => el.text(value ?? "")]],
	"data-attr": (spec, el) =>
		spec.split(" ").map((pair) => {
			const [attribute = "", slot = "", ...rest] = pair.split("=");
			if (!KEY.test(attribute) || rest.length) malformed(spec);
			return [key(slot), (value) => el.set(attribute, value)];
		}),
	"data-fade": (spec, el) => [
		[key(spec), (value, fade) => value !== null && el.image(value, fade)],
	],
};

/** A selector for every element that shows a slot. */
export const BOUND = Object.keys(DIRECTIVES)
	.map((name) => `[${name}]`)
	.join(",");

/** The slots one element shows, each with the write that puts a value there. */
export const bindings = (el: Target): Binding[] =>
	Object.entries(DIRECTIVES).flatMap(([name, bind]) => {
		const spec = el.get(name);
		return spec === null ? [] : bind(spec, el);
	});
