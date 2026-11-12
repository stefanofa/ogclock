import { clock, weekdayName } from "../../core/calendar.ts";
import type { Moment } from "../../core/moment.ts";
import { dayProgress, percent } from "../../core/progress.ts";
import { HEIGHT, type Theme, WIDTH } from "../theme.ts";
import { Canvas, Mark } from "../ui.tsx";

const RED = "#E4322B";
const INK = "#111111";
const FONT = "Inter Tight";

/** One tick per hour; 06, 12 and 18 stand taller. */
const TICKS = Array.from({ length: 23 }, (_, i) => ({
	x: (i + 1) * 50 - 1,
	major: (i + 1) % 6 === 0,
}));

const Ruler = ({ color }: { color: string }) => (
	<svg
		width={WIDTH}
		height={28}
		viewBox={`0 0 ${WIDTH} 28`}
		style={{ position: "absolute", left: 0, top: HEIGHT - 28 }}
	>
		{TICKS.map(({ x, major }) => (
			<rect x={x} y={major ? 6 : 16} width={2} height={major ? 22 : 12} fill={color} />
		))}
	</svg>
);

/** The whole layout in one ink. Drawn twice: dark on white, then white clipped to the red field. */
const Layer = ({
	m,
	ink,
	faint,
	mark,
}: {
	m: Moment;
	ink: string;
	faint: string;
	mark: number;
}) => (
	<Canvas
		background="transparent"
		style={{
			position: "absolute",
			left: 0,
			top: 0,
			paddingBottom: 20,
			fontFamily: FONT,
			color: ink,
		}}
	>
		<div style={{ fontSize: 34, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: "40px" }}>
			{clock(m)}
		</div>
		<div
			style={{
				paddingTop: 6,
				fontSize: 220,
				fontWeight: 800,
				letterSpacing: "-0.055em",
				lineHeight: "206px",
			}}
		>
			{`${percent(dayProgress(m).fraction)}%`}
		</div>
		<div
			style={{
				paddingTop: 10,
				fontSize: 47,
				fontWeight: 600,
				letterSpacing: "-0.025em",
				lineHeight: "56px",
			}}
		>
			{`of ${weekdayName(m)} is already gone.`}
		</div>
		<Ruler color={faint} />
		<Mark
			style={{
				left: 48,
				top: 40,
				fontSize: 20,
				fontWeight: 600,
				opacity: mark,
				letterSpacing: "-0.005em",
			}}
		/>
	</Canvas>
);

export const dayGone = {
	code: 1,
	id: "day-gone",
	name: "Day gone",
	line: (m) => `${percent(dayProgress(m).fraction)}% of ${weekdayName(m)} is already gone.`,
	render: (m) => {
		const width = Math.round(dayProgress(m).fraction * WIDTH);
		return (
			<Canvas background="#FFFFFF">
				<Layer m={m} ink={INK} faint="#11111138" mark={0.55} />
				<div
					style={{
						position: "absolute",
						left: 0,
						top: 0,
						width,
						height: HEIGHT,
						overflow: "hidden",
						display: "flex",
						background: RED,
					}}
				>
					<Layer m={m} ink="#FFFFFF" faint="#FFFFFF80" mark={0.8} />
				</div>
			</Canvas>
		);
	},
} satisfies Theme;
