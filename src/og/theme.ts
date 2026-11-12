import type { JSXElement } from "satori/jsx";
import type { Moment } from "../core/moment.ts";

export const WIDTH = 1200;
export const HEIGHT = 630;

/**
 * A theme turns a Moment into a preview image. It is pure: the same Moment always
 * renders the same pixels, so a rendered frame can be cached forever.
 */
export interface Theme {
	/** Stable wire code inside links. Never reuse or renumber. 0 is reserved for Auto. */
	readonly code: number;
	readonly id: string;
	readonly name: string;
	/** The image's line as plain text: og:title, alt text and the page caption. */
	readonly line: (m: Moment) => string;
	readonly render: (m: Moment) => JSXElement;
}
