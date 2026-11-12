import { clock, monthName, weekdayName } from "../../core/calendar.ts";
import { largest, plural } from "../../core/duration.ts";
import type { Moment } from "../../core/moment.ts";
import { percent, yearProgress } from "../../core/progress.ts";
import type { Theme } from "../theme.ts";
import { Canvas, Mark } from "../ui.tsx";

const GREY = "#9C9C9C";
const COLUMN = 634;

/** Twenty cells of 5% each; the current one fills by what is left over. */
const CELLS = 20;
const CELL = { width: 26, height: 52, gap: 6, radius: 3 } as const;

/** "50 days left", then hours on the last day, then minutes in the last hour. */
const left = (remainingMinutes: number) => `${plural(...largest(remainingMinutes))} left`;

/** The minutes a year is most itself: its halfway minute, its last day, its first hour. */
export const isYearMilestone = (m: Moment) => {
	const { elapsedMinutes, remainingMinutes } = yearProgress(m);
	return (
		elapsedMinutes === remainingMinutes ||
		(m.month === 12 && m.day === 31) ||
		(m.month === 1 && m.day === 1 && m.hour === 0)
	);
};

const headline = (m: Moment) => `${m.year} is ${percent(yearProgress(m).fraction)}%`;

const Bar = ({ fraction }: { fraction: number }) => {
	const filled = fraction * CELLS;
	const current = Math.floor(filled);
	const x = (i: number) => i * (CELL.width + CELL.gap);
	const cell = (i: number, fill: string, extra?: Record<string, string | number>) => (
		<rect
			x={x(i)}
			y={0}
			width={CELL.width}
			height={CELL.height}
			rx={CELL.radius}
			fill={fill}
			{...extra}
		/>
	);
	return (
		<svg
			width={COLUMN}
			height={CELL.height}
			viewBox={`0 0 ${COLUMN} ${CELL.height}`}
			style={{ display: "flex" }}
		>
			<defs>
				<pattern id="ahead" width={6} height={6} patternUnits="userSpaceOnUse">
					<rect x={0} y={0} width={2} height={2} fill="#FFFFFF" />
					<rect x={3} y={3} width={2} height={2} fill="#FFFFFF" />
				</pattern>
				<clipPath id="now">
					<rect x={x(current)} y={0} width={(filled - current) * CELL.width} height={CELL.height} />
				</clipPath>
			</defs>
			{Array.from({ length: CELLS }, (_, i) =>
				i < current ? cell(i, "#FFFFFF") : cell(i, "url(#ahead)", { fillOpacity: 0.75 }),
			)}
			{current < CELLS && cell(current, "#FFFFFF", { clipPath: "url(#now)" })}
		</svg>
	);
};

const Mono = ({ children }: { children: string }) => (
	<div
		style={{
			fontFamily: "Geist Mono",
			fontSize: 24,
			fontWeight: 500,
			letterSpacing: "0.02em",
			lineHeight: "30px",
			color: GREY,
		}}
	>
		{children}
	</div>
);

export const year = {
	code: 5,
	id: "year",
	name: "Year",
	line: (m) => `${headline(m)} complete. ${left(yearProgress(m).remainingMinutes)}.`,
	render: (m) => {
		const progress = yearProgress(m);
		return (
			<Canvas background="#000000">
				<div style={{ width: COLUMN, display: "flex", flexDirection: "column" }}>
					<Mono>{`${weekdayName(m).slice(0, 3)} ${m.day} ${monthName(m).slice(0, 3)} · ${clock(m)}`}</Mono>
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							paddingTop: 20,
							fontFamily: "Geist",
							fontSize: 96,
							fontWeight: 700,
							letterSpacing: "-0.05em",
							lineHeight: "96px",
							color: "#FFFFFF",
						}}
					>
						<div>{headline(m)}</div>
						<div>complete.</div>
					</div>
					<div style={{ display: "flex", paddingTop: 44 }}>
						<Bar fraction={progress.fraction} />
					</div>
					<div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 16 }}>
						<Mono>{left(progress.remainingMinutes)}</Mono>
					</div>
				</div>
				<Mark
					style={{
						right: 48,
						top: 566,
						fontFamily: "Geist",
						fontSize: 20,
						fontWeight: 600,
						letterSpacing: "-0.01em",
						lineHeight: "24px",
						color: "#5E5E5E",
					}}
				/>
			</Canvas>
		);
	},
} satisfies Theme;
