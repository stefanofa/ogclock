import { clock, longDate } from "../../core/calendar.ts";
import type { Moment } from "../../core/moment.ts";
import { isDaylight } from "../../core/sun.ts";
import type { Theme } from "../theme.ts";
import { Canvas, Mark } from "../ui.tsx";

/** Minutes worth naming. The headline never changes; these add a line above it. */
const OCCASIONS: readonly {
	readonly when: (m: Moment) => boolean;
	readonly say: (m: Moment) => string;
}[] = [
	{
		when: (m) => m.month === 1 && m.day === 1 && m.minuteOfDay === 0,
		say: (m) => `The first minute of ${m.year}.`,
	},
	{
		when: (m) => m.month === 12 && m.day === 31 && m.minuteOfDay === 1439,
		say: (m) => `The last minute of ${m.year}.`,
	},
	{
		when: (m) => m.month === 11 && m.day === 11 && m.hour === 11 && m.minute === 11,
		say: () => "11:11 on 11/11.",
	},
	{ when: (m) => m.month === 2 && m.day === 29, say: () => "A leap-day minute." },
];

export const occasion = (m: Moment) => OCCASIONS.find((o) => o.when(m))?.say(m);

const PALETTES = {
	day: { background: "#F5F4F0", ink: "#111111", date: "#5E5E5B", accent: "#111111" },
	night: { background: "#101010", ink: "#F2EFE8", date: "#8F8B82", accent: "#CDB57E" },
} as const;

export const once = {
	code: 4,
	id: "once",
	name: "Once",
	line: (m) => [occasion(m), "This minute will never happen again."].filter(Boolean).join(" "),
	render: (m) => {
		const palette = isDaylight(m) ? PALETTES.day : PALETTES.night;
		const named = occasion(m);
		return (
			<Canvas background={palette.background}>
				{named && (
					<div
						style={{
							fontFamily: "Instrument Serif",
							fontStyle: "italic",
							fontSize: 34,
							lineHeight: "40px",
							paddingBottom: 14,
							color: palette.accent,
						}}
					>
						{named}
					</div>
				)}
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						fontFamily: "Instrument Serif",
						fontSize: 104,
						letterSpacing: "-0.022em",
						lineHeight: "96px",
						color: palette.ink,
					}}
				>
					<div>This minute</div>
					<div>will never</div>
					<div>happen again.</div>
				</div>
				<div style={{ width: 36, height: 1, marginTop: 38, background: palette.accent }} />
				<div
					style={{
						display: "flex",
						paddingTop: 20,
						fontFamily: "Inter Tight",
						fontSize: 26,
						fontWeight: 500,
						letterSpacing: "0.01em",
						lineHeight: "32px",
						color: palette.date,
					}}
				>
					{`${longDate(m)} · `}
					<span style={{ color: palette.ink, fontWeight: 600, paddingLeft: 7 }}>{clock(m)}</span>
				</div>
				<Mark
					style={{
						bottom: 34,
						fontFamily: "Inter Tight",
						fontSize: 14,
						fontWeight: 500,
						letterSpacing: "0.18em",
						lineHeight: "18px",
						textTransform: "uppercase",
						color: palette.ink,
						opacity: 0.38,
					}}
				/>
			</Canvas>
		);
	},
} satisfies Theme;
