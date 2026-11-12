/**
 * What the Worker hands the page: the boot payload inside the HTML and the body of
 * GET /api/now/{zoneCode}. Plain JSON, so the page never imports themes or Satori.
 */

/** How one theme looks for one minute: its line and its image. */
export interface Look {
	readonly code: number;
	readonly id: string;
	readonly name: string;
	/** og:title and alt text for this image. */
	readonly line: string;
	/** Immutable /og/{frame}.png path. */
	readonly image: string;
}

/** Every theme's look for one minute in one zone. */
export interface Minute {
	/** Epoch milliseconds at the start of the minute. */
	readonly instant: number;
	/** Zone wire code the looks were drawn for. Times on the page read in this zone. */
	readonly zone: number;
	/** The theme the director picks for Auto. */
	readonly auto: number;
	readonly themes: readonly Look[];
}

/** The current minute plus the next, so the page can preload before the boundary. */
export interface Now {
	readonly minute: Minute;
	readonly next: Minute;
}

export interface Boot {
	/** Domain shown before the slug in links, "ogclock.app". */
	readonly host: string;
	/** Zone wire code the server minted for, from the edge's view of the visitor. */
	readonly zone: number;
	/** A share token nobody has seen yet. */
	readonly link: string;
	/** Chosen theme code; 0 is Auto. */
	readonly theme: number;
	/** Opened from someone else's link. */
	readonly received: boolean;
	/** The server's clock as it built the page, epoch milliseconds. The page ticks on it. */
	readonly serverNow: number;
	readonly now: Now;
}
