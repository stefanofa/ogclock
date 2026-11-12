import { mint, zoneCode } from "../link.ts";
import type { Boot } from "../protocol.ts";
import { slots } from "../slots.ts";
import { initial, reduce, type State } from "../state.ts";
import { copy, createStore, type Effect, follow, minted, share, tick } from "./effects.ts";
import { dragToClose } from "./sheet.ts";
import { motion, mount } from "./view.ts";

const boot: Boot = JSON.parse(document.getElementById("boot")?.textContent ?? "");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Crossfade for a changed picture: a new pick within the minute, or the minute turning. */
const FADE_MS = { pick: 200, turn: 180 } as const;

/**
 * This device's clock as the page's first byte arrived, the reading closest to the moment the
 * server read boot.serverNow. Reading it once the script runs would count the page's own load
 * time as clock skew.
 */
const responded = () => {
	const [nav] = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
	return nav?.responseStart ? performance.timeOrigin + nav.responseStart : Date.now();
};

/**
 * The edge saw one zone, the browser knows its own. The browser wins and refetches. A link
 * this page put in the address bar comes back on reload; it was never received.
 */
const start = (): State => {
	const booted = initial({ ...boot, received: boot.received && !minted() }, responded());
	const state = reduce(booted, { type: "tick", now: Date.now() });
	const zone = zoneCode(Intl.DateTimeFormat().resolvedOptions().timeZone, boot.zone);
	return zone === boot.zone
		? state
		: { ...state, zone, link: mint(zone, state.theme), next: undefined };
};

const paint = mount(document);
const view: Effect = (prev, next) => {
	const sameMinute = prev?.minute.instant === next.minute.instant;
	paint(slots(next), !prev || reduced ? 0 : sameMinute ? FADE_MS.pick : FADE_MS.turn);
};

const picker = document.querySelector<HTMLElement>(".picker");
const opener = document.querySelector<HTMLElement>(".choose");

/** An opened sheet shows the stage and focuses the chosen tile; a closed one hands focus back. */
const focus: Effect = (prev, next) => {
	if (!prev || prev.sheet === next.sheet) return;
	if (next.sheet) {
		document
			.querySelector(".stage")
			?.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" });
		picker?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus({ preventScroll: true });
	} else if (picker?.contains(document.activeElement)) {
		opener?.focus({ preventScroll: true });
	}
};

const store = createStore(start(), (store) => [
	view,
	reduced ? () => {} : motion(document),
	follow(store),
	focus,
]);

const choose = (theme: number) =>
	store.dispatch({ type: "theme", theme, link: mint(store.get().zone, theme) });

const ACTIONS = {
	copy: () => void copy(store, document.querySelector(".link")),
	share: () => void share(store),
	open: () => store.dispatch({ type: "sheet", open: true }),
	close: () => store.dispatch({ type: "sheet", open: false }),
} satisfies Record<string, () => void>;

const isAction = (name: string | undefined): name is keyof typeof ACTIONS =>
	name !== undefined && Object.hasOwn(ACTIONS, name);

document.addEventListener("click", (event) => {
	const target = (event.target as Element).closest<HTMLElement>("[data-theme], [data-action]");
	const action = target?.dataset.action;
	if (target?.dataset.theme) choose(Number(target.dataset.theme));
	else if (isAction(action)) ACTIONS[action]();
});

/** Radio group keys: arrows move the selection along the tiles, Home and End jump. */
const STEPS: Readonly<Record<string, (index: number, count: number) => number>> = {
	ArrowRight: (i, n) => (i + 1) % n,
	ArrowDown: (i, n) => (i + 1) % n,
	ArrowLeft: (i, n) => (i - 1 + n) % n,
	ArrowUp: (i, n) => (i - 1 + n) % n,
	Home: () => 0,
	End: (_, n) => n - 1,
};

document.querySelector(".tiles")?.addEventListener("keydown", (event) => {
	const key = (event as KeyboardEvent).key;
	const step = STEPS[key];
	if (!step) return;
	event.preventDefault();
	const radios = [...document.querySelectorAll<HTMLElement>(".tiles [role=radio]")];
	const index = radios.indexOf(document.activeElement as HTMLElement);
	const target = radios[step(Math.max(0, index), radios.length)];
	if (!target) return;
	choose(Number(target.dataset.theme));
	target.focus();
});

document.addEventListener("keydown", (event) => {
	if (event.key === "Escape" && store.get().sheet) ACTIONS.close();
});

if (!("share" in navigator)) {
	for (const el of document.querySelectorAll<HTMLElement>("[data-action=share]")) el.hidden = true;
}
if (picker) dragToClose(picker, ACTIONS.close);

tick(store);
