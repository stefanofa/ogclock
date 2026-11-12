import satori, { init } from "satori/standalone";
import { nodeEngine } from "./engine.node.ts";
import { FONTS, type FontId } from "./fonts.ts";

const element = (style: Record<string, string | number>, children: unknown) => ({
	type: "div",
	key: null,
	props: { style, children },
});

/**
 * How wide Satori sets each text in one face, in pixels. metrics.gen.ts is made from these
 * widths and tested against them. Each text gets its own red row, read back from the SVG.
 */
export const measure = async (
	id: FontId,
	texts: readonly string[],
	size: number,
	tracking = 0,
): Promise<number[]> => {
	const engine = await nodeEngine();
	await init(engine.yoga);
	const { family, weight, style } = FONTS[id];
	const rows = texts.map((text) =>
		element(
			{
				display: "flex",
				whiteSpace: "pre",
				backgroundColor: "#ff0000",
				fontFamily: family,
				fontWeight: weight,
				fontStyle: style,
				fontSize: size,
				letterSpacing: `${tracking}em`,
			},
			text,
		),
	);
	const svg = await satori(
		element({ display: "flex", flexDirection: "column", alignItems: "flex-start" }, rows),
		{
			width: 20 * size,
			height: 2 * size * texts.length,
			fonts: [{ name: family, weight, style, data: await engine.fonts(id) }],
		},
	);
	const widths = [...svg.matchAll(/<rect [^>]*width="([\d.]+)"[^>]*fill="#ff0000"/g)].map((m) =>
		Number(m[1]),
	);
	if (widths.length !== texts.length)
		throw new Error(`${id}: measured ${widths.length} of ${texts.length} texts`);
	return widths;
};
