import { MINUTE } from "../../core/moment.ts";
import { mint } from "../link.ts";
import type { Now } from "../protocol.ts";
import { type Action, reduce, type State, shown } from "../state.ts";

/**
 * Every side effect the page has: clipboard, share sheet, address bar, timers, network.
 * Each one reads State and answers with Actions; nothing here decides what the page shows.
 */

export interface Store {
	readonly get: () => State;
	readonly dispatch: (action: Action) => void;
}

/** Runs after every state change, and once at start with no previous state. */
export type Effect = (prev: State | undefined, next: State) => void;

/** Holds State and runs each effect, in order, whenever an action changes it. */
export const createStore = (state: State, effects: (store: Store) => readonly Effect[]): Store => {
	let current = state;
	let run: readonly Effect[] = [];
	const store: Store = {
		get: () => current,
		dispatch: (action) => {
			const prev = current;
			current = reduce(prev, action);
			if (current !== prev) for (const effect of run) effect(prev, current);
		},
	};
	run = effects(store);
	for (const effect of run) effect(undefined, current);
	return store;
};

const COPIED_LABEL_MS = 1600;
const TOAST_MS = 4000;
/** The slug swaps after the label has visibly changed, so the eye catches the new link. */
const FRESH_LINK_MS = 300;
const PRELOAD_MS = 2000;
const RETRY_MS = 1000;

/**
 * Marks the links this page puts in the address bar. history.state outlives a reload or a
 * restored tab, so the page can tell its own link from one it received.
 */
const MINTED = { minted: true } as const;

export const minted = () => (history.state as Partial<typeof MINTED> | null)?.minted === true;

const address = (link: string) => history.replaceState(MINTED, "", `/${link}`);

const fresh = (store: Store) => {
	const { zone, theme } = store.get();
	store.dispatch({ type: "link", link: mint(zone, theme) });
};

/** The URL to hand out. The next link is minted at once, so no two sends ever share one. */
const send = (store: Store) => {
	const { link, zone, theme } = store.get();
	store.dispatch({ type: "sent", link: mint(zone, theme) });
	return `${location.origin}/${link}`;
};

export const copy = async (store: Store, fallback: Element | null) => {
	const url = send(store);
	try {
		await navigator.clipboard.writeText(url);
	} catch {
		// No clipboard permission: select the link so the visitor can copy it by hand.
		if (fallback) getSelection()?.selectAllChildren(fallback);
		return;
	}
	store.dispatch({ type: "copied" });
	const { copies } = store.get();
	setTimeout(() => store.dispatch({ type: "reveal" }), FRESH_LINK_MS);
	setTimeout(() => store.dispatch({ type: "settle", copy: copies }), COPIED_LABEL_MS);
	setTimeout(() => store.dispatch({ type: "dismiss", copy: copies }), TOAST_MS);
};

export const share = async (store: Store) => {
	try {
		await navigator.share({ url: send(store) });
	} catch {
		// Dismissing the share sheet rejects too. The link may not have left; a new one costs nothing.
	}
	store.dispatch({ type: "reveal" });
};

/**
 * One tick per second of the server's clock, aligned so the minute turns on :00. A hidden
 * tab does no minute work at all and catches up when it shows again.
 */
export const tick = (store: Store) => {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const loop = () => {
		store.dispatch({ type: "tick", now: Date.now() });
		timer = setTimeout(loop, 1000 - ((Date.now() + store.get().offset) % 1000) + 5);
	};
	if (!document.hidden) loop();
	document.addEventListener("visibilitychange", () => {
		clearTimeout(timer);
		if (document.hidden) return;
		fresh(store);
		loop();
	});
};

/**
 * Fetches frames whenever the next minute is unknown. Each fetch that does not carry the page
 * into a new minute waits twice as long as the one before, so data that keeps going stale
 * cannot turn into polling.
 */
const sync = (store: Store) => {
	let busy = false;
	let wait = 0;
	const run = () => {
		if (busy || store.get().next || document.hidden) return;
		busy = true;
		setTimeout(() => {
			// The tab may have been hidden while this waited: showing it again fetches afresh.
			if (document.hidden) {
				busy = false;
				return;
			}
			fetch(`/api/now/${store.get().zone}`)
				.then((res) => (res.ok ? (res.json() as Promise<Now>) : Promise.reject(res.status)))
				.then((now) => {
					if (!document.hidden) store.dispatch({ type: "now", now });
				})
				.catch(() => undefined)
				.finally(() => {
					busy = false;
					run();
				});
		}, wait);
		wait = Math.min(Math.max(RETRY_MS, wait * 2), MINUTE);
	};
	return (prev: State | undefined, next: State) => {
		if (next.minute === prev?.next) wait = 0;
		run();
	};
};

/** Warms the cache with next minute's image so :00 swaps without waiting. */
const preload = () => {
	let warmed = "";
	return (s: State) => {
		if (document.hidden || !s.next || s.next.instant - s.clock > PRELOAD_MS) return;
		const { image } = shown({ ...s, minute: s.next });
		if (image === warmed) return;
		warmed = image;
		new Image().src = image;
	};
};

/** The address bar, the next minute's data and its image, kept in step with State. */
export const follow = (store: Store): Effect => {
	const fetchNext = sync(store);
	const warm = preload();
	return (prev, next) => {
		if (prev?.link !== next.link) address(next.link);
		fetchNext(prev, next);
		warm(next);
	};
};
