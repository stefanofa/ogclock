import { along, blend, lerp, mix, type Stops } from "../../color.ts";

/**
 * The two designs, Tokyo on 11 November 2026 at 16:24 and 14:32, by the sun's altitude. The
 * palettes sit at those altitudes rounded. Moving them onto the exact ones recolours every
 * daytime image.
 */
export const DUSK = { altitude: 1.68, palette: 1.7 } as const;
export const AFTERNOON = { altitude: 20.9, palette: 21 } as const;

/** Everything that changes with the sun's altitude. Numbers interpolate, colours mix. */
export interface Light {
	readonly sky: Stops;
	readonly sea: Stops;
	readonly halo: { readonly size: number; readonly stops: Stops };
	readonly sun: { readonly size: number; readonly color: string; readonly glow: string };
	readonly reflection: { readonly width: number; readonly height: number; readonly stops: Stops };
	readonly glitter: {
		readonly color: string;
		readonly depth: number;
		readonly spread: number;
		readonly opacity: number;
	};
}

const LIGHTS: readonly (readonly [altitude: number, Light])[] = [
	[
		-14,
		{
			sky: [
				[0, "#090D20"],
				[30, "#10172F"],
				[52.4, "#1C2440"],
			],
			sea: [
				[0, "#1A2038"],
				[30, "#10152A"],
				[100, "#080A14"],
			],
			halo: {
				size: 320,
				stops: [
					[0, "#FF9A5A00"],
					[70, "#FF9A5A00"],
				],
			},
			sun: { size: 64, color: "#FFE6AE", glow: "#FFC47800" },
			reflection: {
				width: 200,
				height: 220,
				stops: [
					[0, "#FFAA6400"],
					[100, "#FFAA6400"],
				],
			},
			glitter: { color: "#FF9F6A", depth: 200, spread: 26, opacity: 0 },
		},
	],
	[
		-4,
		{
			sky: [
				[0, "#1C2350"],
				[20, "#3A3868"],
				[36, "#7A5472"],
				[45, "#B4685E"],
				[52.4, "#D9895A"],
			],
			sea: [
				[0, "#8A5A62"],
				[9, "#5A4058"],
				[34, "#33283F"],
				[72, "#1C1830"],
				[100, "#141224"],
			],
			halo: {
				size: 420,
				stops: [
					[0, "#FFB06A66"],
					[18, "#FF9A5A40"],
					[42, "#FF8A5014"],
					[70, "#FF7A4800"],
				],
			},
			sun: { size: 64, color: "#FFE6AE", glow: "#FFC47800" },
			reflection: {
				width: 220,
				height: 240,
				stops: [
					[0, "#FF9A5A30"],
					[45, "#FF8A5010"],
					[100, "#FF8A5000"],
				],
			},
			glitter: { color: "#FF9F6A", depth: 200, spread: 26, opacity: 0 },
		},
	],
	[
		DUSK.palette,
		{
			sky: [
				[0, "#31407A"],
				[20, "#6E5F92"],
				[36, "#D6807A"],
				[45, "#F59F5E"],
				[52.4, "#FFD07F"],
			],
			sea: [
				[0, "#C98274"],
				[9, "#8C5A6C"],
				[34, "#4E3858"],
				[72, "#241D38"],
				[100, "#191528"],
			],
			halo: {
				size: 380,
				stops: [
					[0, "#FFE2A0F2"],
					[18, "#FFB86E80"],
					[42, "#FFA0602E"],
					[70, "#FF965A00"],
				],
			},
			sun: { size: 64, color: "#FFE6AE", glow: "#FFC478BF" },
			reflection: {
				width: 200,
				height: 240,
				stops: [
					[0, "#FFBA6E80"],
					[45, "#FFAA642E"],
					[100, "#FFAA6400"],
				],
			},
			glitter: { color: "#FFC97E", depth: 230, spread: 26, opacity: 0.85 },
		},
	],
	[
		AFTERNOON.palette,
		{
			sky: [
				[0, "#6A9ACB"],
				[30, "#A3C0DC"],
				[46, "#DCD6C4"],
				[52.4, "#F1D9AE"],
			],
			sea: [
				[0, "#7D93AE"],
				[14, "#587594"],
				[45, "#3E5A7C"],
				[100, "#253E5C"],
			],
			halo: {
				size: 280,
				stops: [
					[0, "#FFF6DED9"],
					[22, "#FFF0CD73"],
					[48, "#FFECC424"],
					[70, "#FFECC400"],
				],
			},
			sun: { size: 60, color: "#FFFBF0", glow: "#FFF4D6B3" },
			reflection: {
				width: 180,
				height: 190,
				stops: [
					[0, "#FFEECD52"],
					[45, "#FFEECD1F"],
					[100, "#FFEECD00"],
				],
			},
			glitter: { color: "#FFF4DA", depth: 170, spread: 22, opacity: 0.75 },
		},
	],
];

const blendLight = (a: Light, b: Light, t: number): Light => ({
	sky: blend(a.sky, b.sky, t),
	sea: blend(a.sea, b.sea, t),
	halo: { size: lerp(a.halo.size, b.halo.size, t), stops: blend(a.halo.stops, b.halo.stops, t) },
	sun: {
		size: lerp(a.sun.size, b.sun.size, t),
		color: mix(a.sun.color, b.sun.color, t),
		glow: mix(a.sun.glow, b.sun.glow, t),
	},
	reflection: {
		width: lerp(a.reflection.width, b.reflection.width, t),
		height: lerp(a.reflection.height, b.reflection.height, t),
		stops: blend(a.reflection.stops, b.reflection.stops, t),
	},
	glitter: {
		color: mix(a.glitter.color, b.glitter.color, t),
		depth: lerp(a.glitter.depth, b.glitter.depth, t),
		spread: lerp(a.glitter.spread, b.glitter.spread, t),
		opacity: lerp(a.glitter.opacity, b.glitter.opacity, t),
	},
});

/** The light at a solar altitude, blended between the nearest two in the table. */
export const lightAt = (altitude: number): Light => along(LIGHTS, altitude, blendLight);
