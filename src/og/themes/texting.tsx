import { clock } from "../../core/calendar.ts";
import { during, type Hours, hours, minutesInto } from "../../core/hours.ts";
import type { Moment, Weekday } from "../../core/moment.ts";
import type { Theme } from "../theme.ts";
import { Canvas, Mark } from "../ui.tsx";

type Level = 1 | 2 | 3 | 4 | 5;

interface Verdict {
	readonly level: Level;
	readonly line: string;
	/** A quieter second line, set under the verdict. */
	readonly aside?: string;
}

interface Rule {
	readonly when: Hours;
	readonly verdict: Verdict;
}

const rule = (span: string, verdict: Verdict, days?: readonly Weekday[]): Rule => ({
	when: hours(span, days),
	verdict,
});

/** First match wins: weekend overrides, then the weekday ladder, which covers every minute. */
const RULES: readonly Rule[] = [
	rule("22:00-02:00", { level: 2, line: "It’s Friday night.", aside: "Anything goes." }, [5]),
	rule("07:00-10:00", { level: 4, line: "It’s Saturday.", aside: "Let them sleep in." }, [6]),
	rule("07:00-10:00", { level: 4, line: "It’s Sunday.", aside: "Let them sleep in." }, [7]),
	rule("20:00-23:00", { level: 3, line: "Sunday night.", aside: "Be gentle." }, [7]),
	rule("00:00-01:00", { level: 4, line: "Bold.", aside: "Very bold." }),
	rule("01:00-05:00", { level: 5, line: "They’re asleep.", aside: "You should be too." }),
	rule("05:00-07:00", { level: 4, line: "Too early.", aside: "Let them dream." }),
	rule("07:00-09:00", { level: 2, line: "Fine.", aside: "Coffee first, probably." }),
	rule("09:00-12:00", { level: 1, line: "Totally normal." }),
	rule("12:00-13:30", { level: 1, line: "Perfect.", aside: "They’re at lunch." }),
	rule("13:30-18:00", { level: 1, line: "Totally normal." }),
	rule("18:00-21:00", { level: 2, line: "Still fine." }),
	rule("21:00-22:00", { level: 3, line: "Getting late.", aside: "Keep it short." }),
	rule("22:00-23:00", { level: 3, line: "Late.", aside: "Make it worth it." }),
	rule("23:00-24:00", { level: 4, line: "Only if it’s good news." }),
];

/** The verdict, plus how far through its window we are, which nudges the needle. */
export const judge = (m: Moment) => {
	for (const { when, verdict } of RULES) {
		const into = minutesInto(when, m);
		if (into !== undefined) return { verdict, progress: into / when.length };
	}
	throw new Error(`no texting rule covers ${clock(m)}`);
};

const isNight = during("21:00-06:00");

const PALETTES = {
	day: {
		background: "#FFFFFF",
		question: "#6B6B70",
		ink: "#141416",
		aside: "#8A8A90",
		mark: "#9A9AA0",
		idle: ["#D3EFDF", "#DDEFC8", "#FBEAB4", "#FBD8BF", "#F9D0D2"],
		lit: ["#1FAF6A", "#7DBB3B", "#E9A800", "#F07A2E", "#E5484D"],
	},
	night: {
		background: "#0B0B0D",
		question: "#8E8E95",
		ink: "#F5F5F7",
		aside: "#7C7C84",
		mark: "#6E6E75",
		idle: ["#163324", "#28331C", "#3A3218", "#3D2619", "#3F1D20"],
		lit: ["#2FD07F", "#9BD150", "#F5C030", "#FF8A47", "#FF5A5F"],
	},
} as const;

/** The gauge: five arcs over the top of a circle, angles measured clockwise from the left. */
const R = 200;
const C = 240;
const SEGMENT_CENTER = (i: number) => 20.6 + 34.7 * i;
const HALF_SPAN = 12;

const point = (degrees: number) => {
	const rad = (degrees * Math.PI) / 180;
	return { x: C - R * Math.cos(rad), y: C - R * Math.sin(rad) };
};

const arc = (from: number, to: number) => {
	const a = point(from);
	const b = point(to);
	return `M${a.x.toFixed(2)} ${a.y.toFixed(2)} A${R} ${R} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
};

const Gauge = ({ level, progress, night }: { level: Level; progress: number; night: boolean }) => {
	const palette = night ? PALETTES.night : PALETTES.day;
	const lit = level - 1;
	const knob = point(SEGMENT_CENTER(lit) + (progress - 0.5) * HALF_SPAN * 1.2);
	return (
		<svg width={480} height={252} viewBox="0 0 480 252">
			<defs>
				<filter id="soft" x="-60%" y="-60%" width="220%" height="220%">
					<feGaussianBlur stdDeviation={night ? 6 : 3} />
				</filter>
			</defs>
			{palette.idle.map((idle, i) => (
				<path
					d={arc(SEGMENT_CENTER(i) - HALF_SPAN, SEGMENT_CENTER(i) + HALF_SPAN)}
					fill="none"
					stroke={i === lit ? palette.lit[i] : idle}
					strokeWidth={30}
					strokeLinecap="round"
				/>
			))}
			{night && (
				<path
					d={arc(SEGMENT_CENTER(lit) - HALF_SPAN, SEGMENT_CENTER(lit) + HALF_SPAN)}
					fill="none"
					stroke={palette.lit[lit]}
					strokeWidth={30}
					strokeLinecap="round"
					filter="url(#soft)"
					opacity={0.45}
				/>
			)}
			{!night && (
				<circle
					cx={knob.x + 1.4}
					cy={knob.y + 4.4}
					r={21}
					fill="#000000"
					opacity={0.22}
					filter="url(#soft)"
				/>
			)}
			<circle cx={knob.x} cy={knob.y} r={21} fill="#FFFFFF" />
			<circle
				cx={knob.x}
				cy={knob.y}
				r={19}
				fill="none"
				stroke={night ? palette.background : palette.ink}
				strokeWidth={5}
			/>
		</svg>
	);
};

export const texting = {
	code: 2,
	id: "texting",
	name: "OK to text?",
	line: (m) => {
		const { verdict } = judge(m);
		return `Is it OK to text right now? ${verdict.line}${verdict.aside ? ` ${verdict.aside}` : ""}`;
	},
	render: (m) => {
		const { verdict, progress } = judge(m);
		const night = isNight(m);
		const palette = night ? PALETTES.night : PALETTES.day;
		const big = !verdict.aside;
		return (
			<Canvas background={palette.background} style={{ fontFamily: "Inter Tight" }}>
				<div
					style={{
						fontSize: 28,
						fontWeight: 500,
						letterSpacing: "-0.01em",
						lineHeight: "34px",
						color: palette.question,
					}}
				>
					Is it OK to text right now?
				</div>
				<div
					style={{
						display: "flex",
						position: "relative",
						paddingTop: big ? 30 : 24,
						paddingBottom: big ? 18 : 14,
					}}
				>
					<Gauge level={verdict.level} progress={progress} night={night} />
					<div
						style={{
							position: "absolute",
							left: 0,
							top: (big ? 30 : 24) + 152,
							width: 480,
							display: "flex",
							justifyContent: "center",
							fontSize: 72,
							fontWeight: 600,
							letterSpacing: "-0.03em",
							lineHeight: "80px",
							color: palette.ink,
						}}
					>
						{clock(m)}
					</div>
				</div>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						fontSize: big ? 88 : 72,
						fontWeight: 800,
						letterSpacing: "-0.04em",
						lineHeight: big ? "96px" : "78px",
						color: palette.ink,
					}}
				>
					<div>{verdict.line}</div>
					{verdict.aside && <div style={{ color: palette.aside }}>{verdict.aside}</div>}
				</div>
				<Mark
					style={{
						right: 36,
						bottom: 28,
						fontSize: 16,
						fontWeight: 500,
						letterSpacing: "0.02em",
						color: palette.mark,
					}}
				/>
			</Canvas>
		);
	},
} satisfies Theme;
