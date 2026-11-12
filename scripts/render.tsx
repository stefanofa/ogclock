/**
 * Renders themes at a moment to PNG files, for design review and debugging.
 *
 *   pnpm render                                   every theme at the canonical moment
 *   pnpm render texting 2026-11-12T03:12          one theme at a local time in Tokyo
 *   pnpm render all 2026-11-15T15:00 Europe/Rome  every theme, another zone
 */
import { mkdir, writeFile } from "node:fs/promises";
import { at } from "../src/core/fixtures.ts";
import { nodeEngine } from "../src/og/engine.node.ts";
import { createRenderer, sceneOf } from "../src/og/render.ts";
import { THEMES } from "../src/og/themes/index.ts";

const [which = "all", local = "2026-11-11T14:32", zoneId = "Asia/Tokyo"] = process.argv.slice(2);
const moment = at(local, zoneId);
const themes = which === "all" ? THEMES : THEMES.filter((t) => t.id === which);
if (!themes.length)
	throw new Error(`no theme "${which}". Try: ${THEMES.map((t) => t.id).join(", ")}`);

const render = createRenderer(await nodeEngine());
const out = new URL("../out/", import.meta.url);
await mkdir(out, { recursive: true });

for (const theme of themes) {
	const started = performance.now();
	const png = await render(sceneOf(theme, moment));
	const ms = (performance.now() - started).toFixed(0);
	const file = new URL(`${theme.id}-${local.replace(/:/g, "")}.png`, out);
	await writeFile(file, png);
	console.log(
		`${theme.id.padEnd(12)} ${ms.padStart(5)} ms ${(png.byteLength / 1024).toFixed(0).padStart(4)} KB  ${theme.line(moment)}`,
	);
}
