import type { CSSProperties, JSXElement, JSXNode } from "satori/jsx";

/**
 * Every font face a theme may use. This catalog is the single source of truth:
 * scripts/fonts.ts downloads exactly these faces, and themes reference them by id.
 */
export const FONTS = {
	"inter-tight-500": { family: "Inter Tight", weight: 500, style: "normal" },
	"inter-tight-600": { family: "Inter Tight", weight: 600, style: "normal" },
	"inter-tight-800": { family: "Inter Tight", weight: 800, style: "normal" },
	"archivo-600": { family: "Archivo", weight: 600, style: "normal" },
	"archivo-700": { family: "Archivo", weight: 700, style: "normal" },
	"archivo-800": { family: "Archivo", weight: 800, style: "normal" },
	"instrument-serif-400": { family: "Instrument Serif", weight: 400, style: "normal" },
	"instrument-serif-400-italic": { family: "Instrument Serif", weight: 400, style: "italic" },
	"instrument-sans-600": { family: "Instrument Sans", weight: 600, style: "normal" },
	"geist-600": { family: "Geist", weight: 600, style: "normal" },
	"geist-700": { family: "Geist", weight: 700, style: "normal" },
	"geist-mono-500": { family: "Geist Mono", weight: 500, style: "normal" },
	"fraunces-500": { family: "Fraunces", weight: 500, style: "normal", opticalSize: 58 },
	"fraunces-600": { family: "Fraunces", weight: 600, style: "normal", opticalSize: 26 },
	"fraunces-400-italic": { family: "Fraunces", weight: 400, style: "italic", opticalSize: 26 },
	"fraunces-display-500": {
		family: "Fraunces Display",
		source: "Fraunces",
		weight: 500,
		style: "normal",
		opticalSize: 120,
	},
	"fraunces-display-500-italic": {
		family: "Fraunces Display",
		source: "Fraunces",
		weight: 500,
		style: "italic",
		opticalSize: 120,
	},
} as const satisfies Record<string, FontFace>;

export interface FontFace {
	/** The CSS family themes ask for. */
	readonly family: string;
	readonly weight: 400 | 500 | 600 | 700 | 800;
	readonly style: "normal" | "italic";
	/** The Google Fonts family to download, when `family` renames it. */
	readonly source?: string;
	/**
	 * A static cut of a variable font's `opsz` axis. Browsers pick the optical size from the
	 * font size; Satori cannot, so a face pins the size it is drawn at.
	 */
	readonly opticalSize?: number;
}

export type FontId = keyof typeof FONTS;

/** Supplies the bytes of a font. Each runtime brings its own: bundled modules, files, a fetch. */
export type FontSource = (id: FontId) => ArrayBuffer | Promise<ArrayBuffer>;

interface Face {
	readonly family: string | undefined;
	readonly weight: number;
	readonly style: string;
}

const key = ({ family, weight, style }: Face) => `${family} ${weight} ${style}`;
const ids = Object.keys(FONTS) as FontId[];
const byFace = new Map(ids.map((id) => [key(FONTS[id]), id]));

/**
 * The faces a tree sets text in, found as Satori finds them: components called, family, weight
 * and style inherited. A face missing from the catalog throws, where Satori would quietly draw
 * the nearest one it has.
 */
export const fontsOf = (tree: JSXNode): FontId[] => {
	const used = new Set<FontId>();
	const walk = (node: JSXNode, face: Face): void => {
		if (typeof node === "string" || typeof node === "number") {
			const id = byFace.get(key(face));
			if (!id) throw new Error(`no font face ${key(face)} for "${node}"`);
			used.add(id);
		} else if (node && typeof node === "object" && Symbol.iterator in node) {
			for (const child of node) walk(child, face);
		} else if (node && typeof node === "object" && "type" in node) {
			const { type, props } = node as JSXElement<{ style?: CSSProperties; children?: JSXNode }>;
			if (typeof type === "function") {
				walk(type(props) as JSXNode, face);
			} else {
				const { fontFamily, fontWeight, fontStyle } = props.style ?? {};
				walk(props.children, {
					family: fontFamily === undefined ? face.family : String(fontFamily),
					weight: fontWeight === undefined ? face.weight : Number(fontWeight),
					style: fontStyle === undefined ? face.style : String(fontStyle),
				});
			}
		}
	};
	walk(tree, { family: undefined, weight: 400, style: "normal" });
	return ids.filter((id) => used.has(id));
};
