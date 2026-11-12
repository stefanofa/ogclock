import { ADVANCES, CHARS } from "./metrics.gen.ts";

export type MeasuredFace = keyof typeof ADVANCES;

interface Table {
	readonly advances: ReadonlyMap<string, number>;
	/** For characters the face was not measured with. */
	readonly widest: number;
}

const table = (list: string): Table => {
	const advances = list.split(" ").map(Number);
	return {
		advances: new Map([...CHARS].map((char, i) => [char, advances[i] ?? 0])),
		widest: Math.max(...advances),
	};
};

const tables = Object.fromEntries(
	Object.entries(ADVANCES).map(([face, list]) => [face, table(list)]),
) as Record<MeasuredFace, Table>;

/**
 * How wide `text` sets, in pixels, before layout. Kerning is ignored, which errs a few pixels
 * either way; callers fitting a line leave that much room.
 */
export const textWidth = (
	face: MeasuredFace,
	text: string,
	size: number,
	/** Letter spacing in em, as in CSS. */
	tracking = 0,
): number => {
	const { advances, widest } = tables[face];
	let units = 0;
	for (const char of text) units += (advances.get(char) ?? widest) + tracking * 1000;
	return (units * size) / 1000;
};

/** The largest size, up to `max`, at which `text` fits in `width` pixels. */
export const fitSize = (
	face: MeasuredFace,
	text: string,
	width: number,
	max: number,
	tracking = 0,
): number => Math.min(max, Math.floor((width / textWidth(face, text, 1000, tracking)) * 1000));
