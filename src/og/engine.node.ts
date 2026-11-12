import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import type { Engine } from "./render.ts";

/** The renderer's engine for Node: scripts and tests. The Worker has its own in src/worker. */
const resolve = createRequire(import.meta.url).resolve;

export const nodeEngine = async (): Promise<Engine> => ({
	yoga: await readFile(resolve("satori/yoga.wasm")),
	resvg: await readFile(resolve("@resvg/resvg-wasm/index_bg.wasm")),
	fonts: async (id) => {
		const file = await readFile(new URL(`./fonts/${id}.bin`, import.meta.url));
		return file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
	},
});
