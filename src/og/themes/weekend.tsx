import { clock } from "../../core/calendar.ts";
import { parts, plural, spoken } from "../../core/duration.ts";
import { MINUTES_PER_DAY, type Moment } from "../../core/moment.ts";
import { minuteOfWeek, weekPhase } from "../../core/week.ts";
import type { Theme } from "../theme.ts";
import { Canvas, Mark } from "../ui.tsx";

const INK = "#16140F";
const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;
const CELL = 86;
const GAP = 5;
const STRIP = DAYS.length * CELL + (DAYS.length - 1) * GAP;

/** Keeps "28 minutes away." together when the headline wraps. */
const NBSP = " ";
const glued = (text: string) => text.replace(/(\d+) /g, `$1${NBSP}`);

/** The headline as a lead that sits on its own line, then the part that may wrap. */
const copy = (m: Moment): { readonly lead: string; readonly rest: string } => {
	const phase = weekPhase(m);
	switch (phase.kind) {
		case "weekday":
			return { lead: "The weekend is", rest: `${glued(spoken(phase.untilWeekend))}${NBSP}away.` };
		case "weekend": {
			const [hours] = parts(phase.weekendLeft, ["hour"]);
			return { lead: "It’s the weekend.", rest: `${glued(plural(...hours))} of it left.` };
		}
		case "sunday-evening":
			return { lead: "Monday is", rest: `${glued(spoken(phase.untilMonday))}${NBSP}away.` };
	}
};

/** How much of each day has passed: 1 for done, 0 for ahead, a fraction for today. */
const elapsed = (m: Moment) =>
	DAYS.map((_, day) =>
		Math.min(1, Math.max(0, (minuteOfWeek(m) - day * MINUTES_PER_DAY) / MINUTES_PER_DAY)),
	);

const Strip = ({ m }: { m: Moment }) => {
	const today = m.weekday - 1;
	const marker = today * (CELL + GAP) + (m.minuteOfDay / MINUTES_PER_DAY) * CELL;
	return (
		<div style={{ display: "flex", position: "relative", width: STRIP, height: 166 }}>
			<div
				style={{
					position: "absolute",
					left: marker - 40,
					top: 48,
					width: 80,
					display: "flex",
					justifyContent: "center",
					fontSize: 24,
					fontWeight: 700,
					letterSpacing: "-0.01em",
					lineHeight: "30px",
				}}
			>
				{clock(m)}
			</div>
			<div
				style={{
					position: "absolute",
					left: marker - 1,
					top: 80,
					width: 2,
					height: 14,
					background: INK,
				}}
			/>
			<div style={{ position: "absolute", left: 0, top: 94, display: "flex", gap: GAP }}>
				{elapsed(m).map((done, day) => {
					const ahead = day < 5 ? "#16140F1A" : "#FFFFFF";
					const pct = `${(done * 100).toFixed(2)}%`;
					return (
						<div
							style={{
								width: CELL,
								height: 44,
								borderRadius: 7,
								backgroundImage: `linear-gradient(90deg, ${INK} ${pct}, ${ahead} ${pct})`,
							}}
						/>
					);
				})}
			</div>
			<div style={{ position: "absolute", left: 0, top: 148, display: "flex", gap: GAP }}>
				{DAYS.map((label, day) => (
					<div
						style={{
							width: CELL,
							display: "flex",
							justifyContent: "center",
							fontSize: 15,
							fontWeight: day < 5 ? 600 : 700,
							letterSpacing: "0.08em",
							lineHeight: "18px",
							opacity: day < 5 ? 0.6 : 1,
						}}
					>
						{label}
					</div>
				))}
			</div>
		</div>
	);
};

export const weekend = {
	code: 3,
	id: "weekend",
	name: "Weekend",
	line: (m) => {
		const { lead, rest } = copy(m);
		return `${lead} ${rest}`.replaceAll(NBSP, " ");
	},
	render: (m) => {
		const monday = weekPhase(m).kind === "sunday-evening";
		const { lead, rest } = copy(m);
		return (
			<Canvas
				background={monday ? "#C7CCD4" : "#FFD22E"}
				style={{ fontFamily: "Archivo", color: INK }}
			>
				<div
					style={{
						width: STRIP,
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						textAlign: "center",
						fontSize: 72,
						fontWeight: 800,
						letterSpacing: "-0.03em",
						lineHeight: "76px",
					}}
				>
					<div>{lead}</div>
					<div>{rest}</div>
				</div>
				<Strip m={m} />
				<Mark
					style={{
						right: 48,
						bottom: 40,
						fontSize: 20,
						fontWeight: 700,
						letterSpacing: "-0.01em",
						opacity: 0.5,
					}}
				/>
			</Canvas>
		);
	},
} satisfies Theme;
