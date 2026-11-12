import { BOUND, bindings, type Slots, slots, type Target } from "../web/slots.ts";
import { initial } from "../web/state.ts";
import { bootJson, head, type Page, tiles } from "./page.ts";

/** HTMLRewriter's side of a slot binding. First paint has nothing to fade from. */
const target = (el: Element): Target => ({
	get: (name) => el.getAttribute(name),
	set: (name, value) =>
		void (value === null ? el.removeAttribute(name) : el.setAttribute(name, value)),
	text: (value) => void el.setInnerContent(value),
	image: (src) => void el.setAttribute("src", src),
});

/** Writes slot values into the elements that name them, the way the browser's view does. */
const fill = (values: Slots) => {
	const byKey = new Map(Object.entries(values));
	return new HTMLRewriter().on(BOUND, {
		element: (el) => {
			for (const [key, write] of bindings(target(el))) {
				const value = byKey.get(key);
				if (value !== undefined) write(value, 0);
			}
		},
	});
};

/**
 * Turns the built shell into this request's page in two streaming passes: the first adds
 * the per-request markup (OG tags, tiles, boot data), the second fills every slot in it.
 */
export const personalise = (shell: Response, page: Page): Response => {
	const structure = new HTMLRewriter()
		.on("meta[charset]", {
			element: (el) => void el.after(head(page.preview).value, { html: true }),
		})
		.on("[data-tiles]", {
			element: (el) =>
				void el.setInnerContent(tiles(page.boot.now.minute.themes).value, { html: true }),
		})
		.on("script#boot", {
			element: (el) => void el.setInnerContent(bootJson(page.boot), { html: true }),
		});
	return fill(slots(initial(page.boot, page.boot.serverNow))).transform(structure.transform(shell));
};
