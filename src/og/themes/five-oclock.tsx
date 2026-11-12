import { clock } from "../../core/calendar.ts";
import type { Moment } from "../../core/moment.ts";
import { placesAtHour } from "../../core/places.ts";
import { fitSize } from "../metrics.ts";
import type { Theme } from "../theme.ts";
import { Band, Canvas, Mark } from "../ui.tsx";

const CREAM = "#F7EFDF";
const PINK = "#FF6B8E";
const SIZE = 120;
/** The place line may run this wide before its type shrinks. */
const MEASURE = 560;
const TRACKING = -0.02;

/** Where it is 5 o'clock: here, or a place the minute picks among those at 17:xx. */
export const where = (m: Moment): string => {
	if (m.hour === 17) return "right here";
	const places = placesAtHour(m.instant, 17);
	return places[m.minuteOfDay % places.length]?.phrase ?? "somewhere";
};

/** A paper cocktail umbrella, leaning into the line it ends. */
const Umbrella = ({ scale }: { scale: number }) => (
	<svg
		width={149 * scale}
		height={166 * scale}
		viewBox="46 28 124 138"
		style={{ position: "absolute", right: -142 * scale, top: -8 * scale }}
	>
		<defs>
			<filter id="blur" x="-30%" y="-30%" width="160%" height="160%">
				<feGaussianBlur stdDeviation={2.6} />
			</filter>
			<linearGradient id="stick" x1={0} y1={0} x2={1} y2={0}>
				<stop offset={0} stopColor="#F4E4C2" />
				<stop offset={1} stopColor="#CDAE78" />
			</linearGradient>
		</defs>
		<g transform="translate(6 8) rotate(26 70 160)" filter="url(#blur)" opacity={0.5}>
			<path d="M70 26 L12 72 Q41 86 70 81 Q99 86 128 72 Z" fill="#05211B" />
			<rect x={68.4} y={78} width={3.2} height={82} rx={1.6} fill="#05211B" />
		</g>
		<g transform="rotate(26 70 160)">
			<rect x={68.3} y={76} width={3.4} height={85} rx={1.7} fill="url(#stick)" />
			{PANELS.map(([d, fill]) => (
				<path d={`M70 26 L${d} Z`} fill={fill} />
			))}
			<circle cx={70} cy={24.2} r={3} fill="#EAD3A4" />
			<circle cx={69.1} cy={23.4} r={1.1} fill="#FFF8E8" />
		</g>
	</svg>
);

/** The canopy's twelve panels, light and dark in turn, as edge-to-edge curves from the tip. */
const PANELS: readonly (readonly [string, string])[] = [
	["12 72 Q12.5 73.6 13.98 74.33", "#FFB3C6"],
	["13.98 74.33 Q16.4 76.2 19.77 76.5", "#F27C99"],
	["19.77 76.5 Q23.6 78.4 28.99 78.36", "#FFA6BC"],
	["28.99 78.36 Q34.5 80.4 41 79.79", "#EE6F8D"],
	["41 79.79 Q47.6 81.8 54.99 80.69", "#FF97B0"],
	["54.99 80.69 Q62.4 82.6 70 81", "#E66282"],
	["70 81 Q77.6 82.6 85.01 80.69", "#F7869F"],
	["85.01 80.69 Q92.4 81.8 99 79.79", "#D95576"],
	["99 79.79 Q105.5 80.4 111.01 78.36", "#E87591"],
	["111.01 78.36 Q116.4 78.4 120.23 76.5", "#C8496A"],
	["120.23 76.5 Q123.6 76.2 126.02 74.33", "#D6688A"],
	["126.02 74.33 Q127.5 73.6 128 72", "#B23E5E"],
];

export const fiveOclock = {
	code: 8,
	id: "five-oclock",
	name: "5 o’clock",
	line: (m) => `It’s 5 o’clock ${where(m)}. ${clock(m)} here.`,
	render: (m) => {
		const place = `${where(m)}.`;
		const size = fitSize("fraunces-display-500-italic", place, MEASURE, SIZE, TRACKING);
		return (
			<Canvas
				background="linear-gradient(180deg, #164C40 0%, #11423A 30%, #0F3D33 55%, #0C332B 100%)"
				style={{ fontFamily: "Fraunces Display", fontWeight: 500, color: CREAM }}
			>
				<div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
					<div
						style={{
							fontSize: size,
							letterSpacing: "-0.03em",
							lineHeight: `${Math.round(size * 1.017)}px`,
							whiteSpace: "pre",
						}}
					>
						It’s 5 o’clock
					</div>
					<div style={{ display: "flex", position: "relative" }}>
						<div
							style={{
								fontSize: size,
								fontStyle: "italic",
								letterSpacing: `${TRACKING}em`,
								lineHeight: `${Math.round(size * 1.067)}px`,
								whiteSpace: "pre",
								color: PINK,
							}}
						>
							{place}
						</div>
						<Umbrella scale={0.55 + (0.45 * size) / SIZE} />
					</div>
				</div>
				<div
					style={{
						paddingTop: 34,
						fontFamily: "Inter Tight",
						fontSize: 32,
						lineHeight: "40px",
						opacity: 0.78,
					}}
				>
					{`${clock(m)} here`}
				</div>
				<Band top={574}>
					<Mark
						style={{
							position: "relative",
							fontFamily: "Inter Tight",
							fontSize: 15,
							letterSpacing: "0.16em",
							lineHeight: "20px",
							textTransform: "uppercase",
							opacity: 0.45,
						}}
					/>
				</Band>
			</Canvas>
		);
	},
} satisfies Theme;
