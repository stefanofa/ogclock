import { clock } from "../../core/calendar.ts";
import { parts } from "../../core/duration.ts";
import { MINUTE, type Moment } from "../../core/moment.ts";
import { altitude, HORIZON, type SunPhase, sunPhase } from "../../core/sun.ts";
import { along, cssStops, lerp } from "../color.ts";
import { random } from "../random.ts";
import { HEIGHT, type Theme, WIDTH } from "../theme.ts";
import { Band, Canvas, Mark } from "../ui.tsx";
import { AFTERNOON, DUSK, type Light, lightAt } from "./sunset/light.ts";

const HORIZON_Y = 330;
const SEA = HEIGHT - HORIZON_Y;

/** What the image says: a countdown, a moment ago, or that the event will not come. */
type Copy =
	| { readonly kind: "until"; readonly lead: string; readonly minutes: number }
	| { readonly kind: "ago"; readonly minutes: number }
	| { readonly kind: "never"; readonly line: string };

/** How long after sunset it still reads as "the sun set". */
const AFTERGLOW = 40;

/** Whole minutes, rounded away from now so a countdown never reads 0. */
const minutesBetween = (a: number, b: number) => Math.max(1, Math.ceil(Math.abs(b - a) / MINUTE));

const phaseOf = (m: Moment) => sunPhase(m.instant, m.zone.lat, m.zone.lon);

const copy = (m: Moment): Copy => {
	const phase = phaseOf(m);
	const now = m.instant;
	switch (phase.kind) {
		case "day":
			return { kind: "until", lead: "Sunset in", minutes: minutesBetween(now, phase.sunset) };
		case "night":
			return phase.sunset !== undefined && now - phase.sunset <= AFTERGLOW * MINUTE
				? { kind: "ago", minutes: minutesBetween(phase.sunset, now) }
				: { kind: "until", lead: "Sunrise in", minutes: minutesBetween(now, phase.sunrise) };
		case "polar-day":
			return { kind: "never", line: "No sunset today." };
		case "polar-night":
			return { kind: "never", line: "No sunrise today." };
	}
};

/** Whether the sun sets within `minutes` where the sender is. */
export const sunsetWithin = (m: Moment, minutes: number) => {
	const phase = phaseOf(m);
	return phase.kind === "day" && phase.sunset - m.instant <= minutes * MINUTE;
};

/** "2 h 06 min" as [number, unit] pairs, so the units can be set smaller. */
const amount = (minutes: number): readonly (readonly [string, string])[] => {
	const [[hours], [rest]] = parts(minutes, ["hour", "minute"]);
	return hours
		? [
				[String(hours), " h "],
				[String(rest).padStart(2, "0"), " min"],
			]
		: [[String(rest), " min"]];
};

const sentence = (c: Copy) => {
	const text = (minutes: number) => amount(minutes).flat().join("");
	switch (c.kind) {
		case "until":
			return `${c.lead} ${text(c.minutes)}.`;
		case "ago":
			return `The sun set ${text(c.minutes)} ago.`;
		case "never":
			return c.line;
	}
};

/** Where the sun stands across the image: 300 at sunrise to 900 at sunset. */
const sunX = (phase: SunPhase, now: number) => {
	switch (phase.kind) {
		case "day": {
			const rise = phase.sunrise ?? phase.sunset - 12 * 60 * MINUTE;
			return lerp(300, 900, Math.min(1, Math.max(0, (now - rise) / (phase.sunset - rise))));
		}
		case "night": {
			const sinceSet = phase.sunset === undefined ? Infinity : now - phase.sunset;
			return sinceSet < phase.sunrise - now ? 900 : 300;
		}
		default:
			return 600;
	}
};

/**
 * The sun's centre by altitude. The drawn sun is far larger than the real one, so it sinks
 * fast near the horizon (its top meets the sea at the real sunset) and rises slowly above,
 * through the two designs, so noon stays in frame.
 */
const SUN_HEIGHT: readonly (readonly [altitude: number, y: number])[] = [
	[-10, 440],
	[HORIZON, HORIZON_Y + 32],
	[DUSK.altitude, 316],
	[AFTERNOON.altitude, 189],
	[45, 132],
	[90, 112],
];

/**
 * The sun's path on the water: short dashes, dense and bright near the horizon, sparser and
 * fainter towards the viewer, scattered around the sun's x.
 */
const Glitter = ({ x, seed, light }: { x: number; seed: number; light: Light["glitter"] }) => {
	if (light.opacity < 0.04) return null;
	const rand = random(seed);
	const dashes: { x: number; y: number; w: number; h: number; o: number }[] = [];
	for (let y = 2; y < light.depth; ) {
		const t = y / light.depth;
		const spread = light.spread * (0.35 + t);
		const n = 2 + Math.floor(rand.next() * 2 + 2 * t);
		for (let k = 0; k < n; k++) {
			const w = rand.between(4, 10 + 34 * (1 - t) * rand.next() + 14 * t);
			const left = rand.gauss(x, spread * 0.55) - w / 2;
			const h = t < 0.35 ? 1.5 : t < 0.7 ? 2 : 2.5;
			const o = light.opacity * (1 - t) ** 1.3 * rand.between(0.45, 1);
			if (o >= 0.04) dashes.push({ x: left, y, w, h, o });
		}
		y += 2.6 + 9 * t * t + rand.between(0, 1.6);
	}
	const height = Math.ceil(light.depth) + 4;
	return (
		<svg
			width={WIDTH}
			height={height}
			viewBox={`0 0 ${WIDTH} ${height}`}
			style={{ position: "absolute", left: 0, top: HORIZON_Y }}
		>
			{dashes.map((d) => (
				<rect
					x={d.x.toFixed(1)}
					y={d.y.toFixed(1)}
					width={d.w.toFixed(1)}
					height={d.h}
					rx={d.h / 2}
					fill={light.color}
					fillOpacity={d.o.toFixed(2)}
				/>
			))}
		</svg>
	);
};

const BIG = 164;
const SMALL = 84;

/**
 * Satori sets mixed sizes on one line by their tops, so the units drop onto the number's
 * baseline by hand: Instrument Serif's ascent minus descent is 0.68 em (hhea 990 / -310).
 */
const UNIT = {
	fontSize: SMALL,
	fontStyle: "italic",
	letterSpacing: 0,
	lineHeight: "150px",
	paddingTop: ((BIG - SMALL) * 0.68) / 2,
} as const;

/** The number at full size, its units set smaller in italics, on one baseline. */
const Amount = ({ minutes, tail = "" }: { minutes: number; tail?: string }) => (
	<div
		style={{
			display: "flex",
			fontSize: BIG,
			letterSpacing: "-0.03em",
			lineHeight: "150px",
			whiteSpace: "pre",
		}}
	>
		{amount(minutes).flatMap(([n, unit], i, all) => [
			<div>{n}</div>,
			<div style={UNIT}>{i === all.length - 1 ? `${unit}${tail}` : unit}</div>,
		])}
	</div>
);

const Lead = ({ children }: { children: string }) => (
	<div style={{ fontSize: 48, fontStyle: "italic", letterSpacing: "-0.01em", lineHeight: "52px" }}>
		{children}
	</div>
);

const words = (c: Copy) => {
	switch (c.kind) {
		case "until":
			return [<Lead>{c.lead}</Lead>, <Amount minutes={c.minutes} />];
		case "ago":
			return [<Lead>The sun set</Lead>, <Amount minutes={c.minutes} tail=" ago." />];
		case "never":
			return [
				<div
					style={{ paddingTop: 20, fontSize: 120, letterSpacing: "-0.03em", lineHeight: "130px" }}
				>
					{c.line}
				</div>,
			];
	}
};

export const sunset = {
	code: 6,
	id: "sunset",
	name: "Sunset",
	line: (m) => sentence(copy(m)),
	render: (m) => {
		const phase = phaseOf(m);
		const alt = altitude(m.instant, m.zone.lat, m.zone.lon);
		const light = lightAt(alt);
		const x = sunX(phase, m.instant);
		const y = along(SUN_HEIGHT, alt, lerp);
		const ring = (size: number) => ({
			position: "absolute" as const,
			left: x - size / 2,
			top: y - size / 2,
			width: size,
			height: size,
			borderRadius: size / 2,
		});
		return (
			<Canvas
				background={`linear-gradient(180deg, ${cssStops(light.sky)})`}
				style={{ justifyContent: "flex-start", fontFamily: "Instrument Serif", color: "#FFFFFF" }}
			>
				<div
					style={{
						...ring(light.halo.size),
						backgroundImage: `radial-gradient(circle, ${cssStops(light.halo.stops)})`,
					}}
				/>
				<div
					style={{
						...ring(light.sun.size),
						backgroundColor: light.sun.color,
						boxShadow: `0px 0px ${light.sun.size * 0.3}px ${light.sun.size * 0.1}px ${light.sun.glow}`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: 0,
						top: HORIZON_Y,
						width: WIDTH,
						height: SEA,
						backgroundImage: `linear-gradient(180deg, ${cssStops(light.sea)})`,
					}}
				/>
				<div
					style={{
						position: "absolute",
						left: x - light.reflection.width / 2,
						top: HORIZON_Y,
						width: light.reflection.width,
						height: light.reflection.height,
						backgroundImage: `radial-gradient(ellipse 50% 100% at 50% 0%, ${cssStops(light.reflection.stops)})`,
					}}
				/>
				<Glitter x={x} seed={m.minuteOfDay} light={light.glitter} />
				<Band top={362}>{words(copy(m))}</Band>
				<Band
					top={40}
					style={{
						fontFamily: "Instrument Sans",
						fontSize: 24,
						fontWeight: 600,
						letterSpacing: "0.01em",
						lineHeight: "30px",
					}}
				>
					{clock(m)}
				</Band>
				<Mark
					style={{
						right: 48,
						top: 566,
						fontFamily: "Instrument Sans",
						fontSize: 20,
						fontWeight: 600,
						lineHeight: "24px",
						opacity: 0.6,
					}}
				/>
			</Canvas>
		);
	},
} satisfies Theme;
