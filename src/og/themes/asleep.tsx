import { clock } from "../../core/calendar.ts";
import { during } from "../../core/hours.ts";
import type { Moment } from "../../core/moment.ts";
import { NIGHT, peopleAsleep } from "../../core/population.ts";
import { darkness } from "../../core/terminator.ts";
import { LAND } from "../land.gen.ts";
import { HEIGHT, type Theme, WIDTH } from "../theme.ts";
import { Band, Canvas, Mark } from "../ui.tsx";
import { MAP_WIDTH, project } from "../world.ts";

const CREAM = "#F4EEE0";
const MAP_TOP = 186;

/** "2 billion", "800 million": one significant figure, because "about" means about. */
export const roughly = (people: number) => {
	const scale = 10 ** Math.floor(Math.log10(Math.max(people, 1)));
	const rounded = Math.round(people / scale) * scale;
	return rounded >= 1e9 ? `${rounded / 1e9} billion` : `${rounded / 1e6} million`;
};

/** The sender is up in the hours the count calls night. */
const isUpLate = during(NIGHT);

const copy = (m: Moment) => ({
	people: `${roughly(peopleAsleep(m.instant))} people`,
	aside: isUpLate(m) ? "You’re not one of them." : undefined,
});

/** The night, in three washes: past sunset, past civil dusk, past nautical dusk. */
const WASHES = [
	{ elevation: 0, opacity: 0.36 },
	{ elevation: -6, opacity: 0.36 },
	{ elevation: -12, opacity: 0.46 },
] as const;

/**
 * Night's outline in map pixels, closed past the dark pole when it holds one. The map wraps, so
 * the outline repeats a map-width to either side.
 */
const nightPath = (instant: number, elevation: number) => {
	const { edge, pole } = darkness(instant, elevation);
	const rim = edge.map(([lon, lat]) => project(lon, Math.min(88, Math.max(-60, lat))));
	const beyond = pole === "north" ? -MAP_TOP - 20 : HEIGHT;
	const ends = [rim.at(-1), rim[0]].map((p) => [p?.[0] ?? 0, beyond] as const);
	const points = pole ? [...rim, ...ends] : rim;
	const ring = (shift: number) =>
		`M${points.map(([x, y]) => `${Math.round(x + shift)} ${Math.round(y)}`).join("L")}Z`;
	return [-MAP_WIDTH, 0, MAP_WIDTH].map(ring).join("");
};

const World = ({ instant }: { instant: number }) => (
	<svg
		width={WIDTH}
		height={HEIGHT}
		viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
		style={{ position: "absolute", left: 0, top: 0 }}
	>
		<defs>
			<pattern id="dots" width={7} height={7} patternUnits="userSpaceOnUse">
				<circle cx={3.5} cy={3.5} r={1.85} fill="#EDE4CF" />
			</pattern>
		</defs>
		<g transform={`translate(0 ${MAP_TOP})`}>
			<path d={LAND} fill="url(#dots)" />
			{WASHES.map(({ elevation, opacity }) => (
				<path d={nightPath(instant, elevation)} fill="#03050B" fillOpacity={opacity} />
			))}
		</g>
	</svg>
);

export const asleep = {
	code: 7,
	id: "asleep",
	name: "Asleep",
	line: (m) => {
		const { people, aside } = copy(m);
		return [`Right now, about ${people} are asleep.`, aside].filter(Boolean).join(" ");
	},
	render: (m) => {
		const { people, aside } = copy(m);
		return (
			<Canvas
				background="#101729"
				style={{ justifyContent: "flex-start", fontFamily: "Fraunces", color: CREAM }}
			>
				<World instant={m.instant} />
				<Band
					top={44}
					style={{
						fontSize: 58,
						fontWeight: 500,
						letterSpacing: "-0.025em",
						lineHeight: "62px",
					}}
				>
					<div>Right now, about</div>
					<div style={{ color: "#FFD98A" }}>{people}</div>
					<div>are asleep.</div>
					{aside && (
						<div
							style={{
								paddingTop: 10,
								fontSize: 26,
								fontStyle: "italic",
								fontWeight: 400,
								letterSpacing: 0,
								lineHeight: "32px",
								opacity: 0.75,
							}}
						>
							{aside}
						</div>
					)}
				</Band>
				<Band
					top={560}
					style={{
						fontSize: 26,
						fontWeight: 600,
						lineHeight: "32px",
					}}
				>
					{clock(m)}
				</Band>
				<Mark
					style={{
						left: 48,
						top: 564,
						fontSize: 20,
						fontWeight: 500,
						lineHeight: "26px",
						opacity: 0.5,
					}}
				/>
			</Canvas>
		);
	},
} satisfies Theme;
