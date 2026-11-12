import { AUTO } from "../core/tokens.ts";
import { HEIGHT, WIDTH } from "../og/theme.ts";
import type { Boot, Look } from "../web/protocol.ts";
import { tileSlots } from "../web/slots.ts";
import { type Html, html } from "./html.ts";

/** What crawlers read: one link's preview. */
export interface Preview {
	readonly url: string;
	readonly title: string;
	readonly image: string;
	readonly alt: string;
}

/** Everything one page response needs. The shell is static; this is the per-request part. */
export interface Page {
	readonly preview: Preview;
	readonly boot: Boot;
}

/** OG tags go first in <head>: Slack reads only the first few KB of a page. */
export const head = ({ url, title, image, alt }: Preview) => html`
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${title}">
<meta property="og:image" content="${image}">
<meta property="og:image:type" content="image/png">
<meta property="og:image:width" content="${WIDTH}">
<meta property="og:image:height" content="${HEIGHT}">
<meta property="og:image:alt" content="${alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:image" content="${image}">`;

/** JSON inside <script>, with "<" escaped so the payload can never close the element. */
export const bootJson = (boot: Boot) => JSON.stringify(boot).replace(/</g, "\\u003c");

const image = (code: number) =>
	html`<img data-fade="${tileSlots(code).thumb}" alt="" width="${WIDTH}" height="${HEIGHT}" loading="lazy" decoding="async">`;

const tile = (code: number, name: string, thumb: Html, note?: string) => {
	const keys = tileSlots(code);
	return html`<button type="button" role="radio" class="${code === AUTO ? "tile auto" : "tile"}" data-theme="${code}" data-attr="aria-checked=${keys.checked} tabindex=${keys.tab}"><span class="thumb">${thumb}</span><span class="tile-name">${name}</span>${note ? html`<span class="tile-note">${note}</span>` : ""}</button>`;
};

/** Auto, drawn as four of the themes it chooses between, then one tile per theme. */
export const tiles = (themes: readonly Look[]) =>
	html`${tile(
		AUTO,
		"Auto",
		html`<span class="quad">${themes.slice(0, 4).map((t) => html`<span>${image(t.code)}</span>`)}</span>`,
		"Best line each minute",
	)}${themes.map((t) => tile(t.code, t.name, image(t.code)))}`;
