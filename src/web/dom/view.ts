import { MINUTE } from "../../core/moment.ts";
import { BOUND, bindings, type Slots, type Target, type Write } from "../slots.ts";
import { elapsed } from "../state.ts";
import type { Effect } from "./effects.ts";

/**
 * Points an <img> at a new picture without a blank frame: decode first, then swap, with a
 * copy of the old picture fading out on top. The latest request wins, and a picture that
 * fails to load never replaces one that works.
 */
const fadeTo = (img: HTMLImageElement, src: string, fade: number) => {
	img.dataset.want = src;
	if (img.getAttribute("src") === src) return;
	// An image that shows nothing yet has nothing to fade from.
	if (!img.complete || !img.naturalWidth) {
		img.src = src;
		return;
	}
	const next = new Image();
	next.src = src;
	next.decode().then(
		() => {
			if (img.dataset.want !== src) return;
			if (fade > 0) {
				const ghost = img.cloneNode() as HTMLImageElement;
				ghost.removeAttribute("data-fade");
				ghost.alt = "";
				img.after(ghost);
				ghost
					.animate({ opacity: [1, 0] }, { duration: fade, easing: "ease-out" })
					.finished.finally(() => ghost.remove());
			}
			img.src = src;
		},
		() => undefined,
	);
};

/**
 * A lazy image (a theme thumbnail) takes a new src only while on screen and catches up when
 * it comes into view, so a background tab or the closed theme sheet costs no renders: render
 * volume follows shares, not views.
 */
const whenSeen = () => {
	const seen = new Set<Element>();
	const show = (img: HTMLImageElement) => {
		const src = img.dataset.want;
		if (src && seen.has(img) && img.getAttribute("src") !== src) img.src = src;
	};
	const observer = new IntersectionObserver((entries) => {
		for (const { target, isIntersecting } of entries) {
			if (isIntersecting) seen.add(target);
			else seen.delete(target);
			show(target as HTMLImageElement);
		}
	});
	return (img: HTMLImageElement): Target["image"] => {
		observer.observe(img);
		return (src) => {
			img.dataset.want = src;
			show(img);
		};
	};
};

/** The DOM's side of a slot binding. */
const target = (el: HTMLElement, lazy: ReturnType<typeof whenSeen>): Target => ({
	get: (name) => el.getAttribute(name),
	set: (name, value) => (value === null ? el.removeAttribute(name) : el.setAttribute(name, value)),
	text: (value) => {
		el.textContent = value;
	},
	image:
		el instanceof HTMLImageElement && el.loading === "lazy"
			? lazy(el)
			: (src, fade) => el instanceof HTMLImageElement && fadeTo(el, src, fade),
});

/** Every element that shows a slot, grouped by slot. */
const writers = (root: ParentNode) => {
	const lazy = whenSeen();
	const byKey = new Map<string, Write[]>();
	for (const el of root.querySelectorAll<HTMLElement>(BOUND)) {
		for (const [key, write] of bindings(target(el, lazy))) {
			byKey.set(key, [...(byKey.get(key) ?? []), write]);
		}
	}
	return byKey;
};

/** Binds the page once; the returned function writes only the slots that changed. */
export const mount = (root: Document) => {
	const byKey = writers(root);
	let last: Readonly<Record<string, string | null>> = {};
	return (next: Slots, fade: number) => {
		for (const [key, value] of Object.entries(next)) {
			if (value === last[key]) continue;
			for (const write of byKey.get(key) ?? []) write(value, fade);
		}
		last = next;
	};
};

/**
 * The two things that move continuously: the minute meter and the logo's seconds hand.
 * Both run on the compositor, started from the server's clock. Without motion the meter
 * steps once a second through its slot and the hand is hidden.
 */
export const motion = (root: Document): Effect => {
	const fill = root.querySelector<HTMLElement>(".fill");
	const hands = [...root.querySelectorAll<SVGElement>(".hand")].map((hand) =>
		hand.animate({ rotate: ["0deg", "360deg"] }, { duration: MINUTE, iterations: Infinity }),
	);
	let meter: Animation | undefined;
	return (prev, s) => {
		if (prev?.minute.instant === s.minute.instant) return;
		if (!prev) for (const hand of hands) hand.currentTime = s.clock % MINUTE;
		meter?.cancel();
		meter = fill?.animate(
			{ transform: [`scaleX(${elapsed(s)})`, "scaleX(1)"] },
			{ duration: Math.max(0, s.minute.instant + MINUTE - s.clock), fill: "forwards" },
		);
	};
};
