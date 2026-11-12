/**
 * Downloads the page's three families from Google Fonts as Latin WOFF2 subsets into
 * src/web/fonts/<family>.woff2. Each is a variable font, so one file covers every weight.
 *
 *   pnpm gen:web-fonts
 */
import { downloadFont, fetchOk } from "./download.ts";

const FAMILIES = {
	"inter-tight": "Inter+Tight:wght@700;800",
	inter: "Inter:wght@400;500;600",
	"geist-mono": "Geist+Mono:wght@500",
} as const;

/** Google serves WOFF2 split by unicode-range only to browsers it recognises. */
const CHROME =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

for (const [file, family] of Object.entries(FAMILIES)) {
	const css = await (
		await fetchOk(`https://fonts.googleapis.com/css2?family=${family}`, {
			headers: { "user-agent": CHROME },
		})
	).text();
	const url = /\/\* latin \*\/[^}]*?url\((https:[^)]+\.woff2)\)/.exec(css)?.[1];
	if (!url) throw new Error(`no Latin WOFF2 for ${family}`);
	const size = await downloadFont(
		url,
		new URL(`../src/web/fonts/${file}.woff2`, import.meta.url),
		"woff2",
	);
	console.log(`${file}: ${(size / 1024).toFixed(1)} KB`);
}
