/// <reference types="vite/client" />
import resvg from "@resvg/resvg-wasm/index_bg.wasm";
import yoga from "satori/yoga.wasm";
import { UTC, zoneById } from "../core/zone.ts";
import cardPng from "../og/card.png.bin";
import type { FontId } from "../og/fonts.ts";
import { createRenderer } from "../og/render.ts";
import { brandCard, handle } from "./app.ts";
import { personalise } from "./shell.ts";

/** Font files bundled as ArrayBuffers, keyed by catalog id. */
const fontFiles = import.meta.glob<ArrayBuffer>("../og/fonts/*.bin", {
	eager: true,
	import: "default",
});
const fonts = (id: FontId) => {
	const data = fontFiles[`../og/fonts/${id}.bin`];
	if (!data) throw new Error(`font ${id} is not bundled; run pnpm gen:fonts`);
	return data;
};

/** One renderer per isolate: wasm and fonts initialise on the first image only. */
const render = createRenderer({ yoga, resvg, fonts });
const card = brandCard(new Uint8Array(cardPng));

export default {
	fetch: (request, env, ctx) =>
		handle(request, {
			now: Date.now,
			render,
			card,
			zoneOf: (req) => zoneById(String(req.cf?.timezone ?? "")) ?? UTC,
			/** The asset binding serves Vite's built index.html; in dev, the transformed source. */
			page: async (page) => personalise(await env.ASSETS.fetch(new URL("/", request.url)), page),
			cache: caches.default,
			defer: (work) => ctx.waitUntil(work),
		}),
} satisfies ExportedHandler<Env>;
