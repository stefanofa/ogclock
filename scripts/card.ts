/**
 * Prebuilds the brand card to src/og/card.png.bin. The Worker serves those bytes as they
 * are, for the bare domain and in place of any image whose render failed, so neither
 * depends on the wasm engines working.
 */
import { writeFile } from "node:fs/promises";
import { card } from "../src/og/card.tsx";
import { nodeEngine } from "../src/og/engine.node.ts";
import { createRenderer } from "../src/og/render.ts";

const png = await createRenderer(await nodeEngine())(card);
await writeFile(new URL("../src/og/card.png.bin", import.meta.url), png);
console.log(`card: ${(png.byteLength / 1024).toFixed(0)} KB`);
