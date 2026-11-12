import { scene } from "./render.ts";
import { Canvas, Mark } from "./ui.tsx";

/**
 * The preview for the bare domain. It shows no time on purpose: platforms cache a URL
 * for days, and a frozen clock on the homepage would be wrong for everyone after.
 */
export const card = scene(
	<Canvas background="#FFFFFF" style={{ fontFamily: "Inter Tight", color: "#111111" }}>
		<div
			style={{
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				fontSize: 92,
				fontWeight: 800,
				letterSpacing: "-0.045em",
				lineHeight: "96px",
			}}
		>
			<div>This link knows</div>
			<div>when you send it.</div>
		</div>
		<div
			style={{
				paddingTop: 28,
				fontSize: 30,
				fontWeight: 500,
				letterSpacing: "-0.01em",
				color: "#6B6B70",
			}}
		>
			Paste it anywhere. The preview shows the moment.
		</div>
		<Mark
			style={{
				bottom: 40,
				fontSize: 20,
				fontWeight: 500,
				letterSpacing: "0.02em",
				color: "#9A9AA0",
			}}
		/>
	</Canvas>,
);
