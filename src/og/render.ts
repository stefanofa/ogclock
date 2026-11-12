import { initWasm, Resvg } from "@resvg/resvg-wasm";
import type { JSXElement } from "satori/jsx";
import satori, { type Font, init as initYoga } from "satori/standalone";
import type { Moment } from "../core/moment.ts";
import { FONTS, type FontId, type FontSource, fontsOf } from "./fonts.ts";
import { HEIGHT, type Theme, WIDTH } from "./theme.ts";

type WasmInput = WebAssembly.Module | ArrayBuffer | ArrayBufferView;

/** What a runtime hands the renderer: the two wasm engines and a way to read fonts. */
export interface Engine {
	readonly yoga: WasmInput;
	readonly resvg: WasmInput;
	readonly fonts: FontSource;
}

/** Anything drawable at 1200×630: an element tree and the font faces it uses. */
export interface Scene {
	readonly element: JSXElement;
	readonly fonts: readonly FontId[];
}

export const scene = (element: JSXElement): Scene => ({ element, fonts: fontsOf(element) });

export const sceneOf = (theme: Theme, moment: Moment): Scene => scene(theme.render(moment));

export type Render = (scene: Scene) => Promise<Uint8Array<ArrayBuffer>>;

/**
 * The wasm engines keep their own "initialised" state for the life of the isolate, which
 * outlives this module when a dev server hot-reloads it. So the guard lives on globalThis,
 * next to the state it protects, rather than in a closure that a reload would reset.
 * Each engine has its own guard, cleared when its start fails so the next render retries.
 * resvg refuses a second initWasm after one succeeds, so a retry restarts only the engine
 * that failed. Satori 0.32 cannot retry yoga: its init resolves before yoga loads and keeps a
 * rejected load for the life of the isolate. The image route's fallback card covers that.
 */
const ENGINES = Symbol.for("ogclock.render.engines");
type Started = { yoga?: Promise<unknown>; resvg?: Promise<unknown> };
type Global = typeof globalThis & { [ENGINES]?: Started };

const startOnce = (name: keyof Started, start: () => Promise<unknown>) => {
	const global = globalThis as Global;
	global[ENGINES] ??= {};
	const started = global[ENGINES];
	started[name] ??= start().catch((error) => {
		delete started[name];
		throw error;
	});
	return started[name];
};

const initEngines = (engine: Engine) =>
	Promise.all([
		startOnce("yoga", () => initYoga(engine.yoga)),
		startOnce("resvg", () => initWasm(engine.resvg)),
	]);

/**
 * Builds a renderer bound to one runtime. Wasm and fonts load once per isolate on first
 * use; every later render only lays out, rasterises and encodes.
 */
export const createRenderer = (engine: Engine): Render => {
	const ready = () => initEngines(engine);
	const fonts = new Map<FontId, Promise<Font>>();

	const font = (id: FontId) => {
		let loading = fonts.get(id);
		if (!loading) {
			const { family, weight, style } = FONTS[id];
			loading = Promise.resolve(engine.fonts(id)).then((data) => ({
				name: family,
				weight,
				style,
				data,
			}));
			fonts.set(id, loading);
		}
		return loading;
	};

	return async ({ element, fonts: ids }) => {
		const [, faces] = await Promise.all([ready(), Promise.all(ids.map(font))]);
		const svg = await satori(element, { width: WIDTH, height: HEIGHT, fonts: faces });
		const resvg = new Resvg(svg, {
			fitTo: { mode: "width", value: WIDTH },
			font: { loadSystemFonts: false },
		});
		try {
			const image = resvg.render();
			try {
				return image.asPng() as Uint8Array<ArrayBuffer>;
			} finally {
				image.free();
			}
		} finally {
			resvg.free();
		}
	};
};
