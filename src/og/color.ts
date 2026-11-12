/** Colours for themes that blend between palettes. Mixing happens in OKLab, as CSS does. */

type Rgba = readonly [r: number, g: number, b: number, a: number];
type Lab = readonly [l: number, a: number, b: number, alpha: number];

const parse = (hex: string): Rgba => {
	const h = hex.replace("#", "");
	const channel = (i: number) => Number.parseInt(h.slice(i, i + 2), 16) / 255;
	return [channel(0), channel(2), channel(4), h.length === 8 ? channel(6) : 1];
};

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

const toLab = ([r, g, b, alpha]: Rgba): Lab => {
	const [lr, lg, lb] = [toLinear(r), toLinear(g), toLinear(b)];
	const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
	const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
	const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
	return [
		0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
		alpha,
	];
};

const toRgba = ([L, A, B, alpha]: Lab): Rgba => {
	const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
	const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
	const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
	return [
		toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
		toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
		toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
		alpha,
	];
};

const format = ([r, g, b, a]: Rgba) => {
	const hex = (c: number) =>
		Math.round(Math.min(1, Math.max(0, c)) * 255)
			.toString(16)
			.padStart(2, "0");
	return `#${hex(r)}${hex(g)}${hex(b)}${a < 1 ? hex(a) : ""}`;
};

/** The colour `t` of the way from `from` to `to`, both "#RRGGBB" or "#RRGGBBAA". */
export const mix = (from: string, to: string, t: number): string => {
	const [a, b] = [toLab(parse(from)), toLab(parse(to))];
	return format(toRgba(a.map((v, i) => v + ((b[i] ?? v) - v) * t) as unknown as Lab));
};

/**
 * A value that follows a key along stops, interpolating between neighbours and holding the
 * ends: the sky's colours along the sun's altitude, say.
 */
export const along = <T>(
	stops: readonly (readonly [key: number, value: T])[],
	key: number,
	lerp: (from: T, to: T, t: number) => T,
): T => {
	const sorted = stops.toSorted(([a], [b]) => a - b);
	const first = sorted[0];
	if (!first) throw new Error("along: no stops");
	if (key <= first[0]) return first[1];
	for (let i = 1; i < sorted.length; i++) {
		const [k0, v0] = sorted[i - 1] ?? first;
		const [k1, v1] = sorted[i] ?? first;
		if (key <= k1) return lerp(v0, v1, (key - k0) / (k1 - k0));
	}
	return (sorted.at(-1) ?? first)[1];
};

export const lerp = (from: number, to: number, t: number) => from + (to - from) * t;

/** A CSS gradient as data: [position in %, colour] pairs, positions ascending. */
export type Stops = readonly (readonly [position: number, color: string])[];

/** The colour a gradient shows at `position`. */
const colorAt = (stops: Stops, position: number): string =>
	along(stops, position, (from, to, t) => mix(from, to, t));

/** Two gradients blended, sampled at every position either one names. */
export const blend = (from: Stops, to: Stops, t: number): Stops =>
	[...new Set([...from, ...to].map(([p]) => p))]
		.sort((a, b) => a - b)
		.map((p) => [p, mix(colorAt(from, p), colorAt(to, p), t)] as const);

/** "#FFF6DE 0%, #FFF0CD 22%", for a CSS gradient. */
export const cssStops = (stops: Stops) => stops.map(([p, c]) => `${c} ${p}%`).join(", ");
