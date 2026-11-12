/**
 * Downloads every face in src/og/fonts.ts from Google Fonts as TTF (Satori cannot read
 * WOFF2) into src/og/fonts/<id>.bin, which the Worker bundles as ArrayBuffers.
 *
 *   pnpm gen:fonts            only the faces that are missing
 *   pnpm gen:fonts --all      every face again
 */
import { access, mkdir } from "node:fs/promises";
import { FONTS, type FontFace } from "../src/og/fonts.ts";
import { downloadFont, fetchOk } from "./download.ts";

const DIR = new URL("../src/og/fonts/", import.meta.url);
const all = process.argv.includes("--all");

/** css2 wants axis tags sorted (ital, opsz, wght) and one value tuple in the same order. */
const query = ({ family, source, weight, style, opticalSize }: FontFace) => {
	const axes: [string, number][] = [
		...(style === "italic" ? [["ital", 1] as [string, number]] : []),
		...(opticalSize ? [["opsz", opticalSize] as [string, number]] : []),
		["wght", weight],
	];
	const name = encodeURIComponent(source ?? family);
	return `${name}:${axes.map(([tag]) => tag).join(",")}@${axes.map(([, v]) => v).join(",")}`;
};

/** Google serves TTF to clients it does not recognise as a modern browser. */
const ttfUrl = async (face: FontFace) => {
	const css = await (
		await fetchOk(`https://fonts.googleapis.com/css2?family=${query(face)}`)
	).text();
	const url = /src: url\((https:[^)]+\.ttf)\)/.exec(css)?.[1];
	if (!url) throw new Error(`no TTF for ${query(face)}`);
	return url;
};

const exists = (file: URL) =>
	access(file).then(
		() => true,
		() => false,
	);

await mkdir(DIR, { recursive: true });
for (const [id, face] of Object.entries(FONTS) as [string, FontFace][]) {
	const file = new URL(`${id}.bin`, DIR);
	if (!all && (await exists(file))) continue;
	const size = await downloadFont(await ttfUrl(face), file, "ttf");
	console.log(`${id}: ${(size / 1024).toFixed(0)} KB`);
}
