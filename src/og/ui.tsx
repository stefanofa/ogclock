import type { CSSProperties, JSXNode } from "satori/jsx";
import { HEIGHT, WIDTH } from "./theme.ts";

/** The 1200×630 root every theme renders into. */
export const Canvas = ({
	background,
	style,
	children,
}: {
	background: string;
	style?: CSSProperties;
	children?: JSXNode;
}) => (
	<div
		style={{
			width: WIDTH,
			height: HEIGHT,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			justifyContent: "center",
			position: "relative",
			overflow: "hidden",
			background,
			...style,
		}}
	>
		{children}
	</div>
);

/** The one quiet brand mark every image carries. */
export const Mark = ({ style }: { style: CSSProperties }) => (
	<div style={{ display: "flex", position: "absolute", ...style }}>ogclock.app</div>
);

/** A full-width strip `top` pixels down the image, its lines centred across it. */
export const Band = ({
	top,
	style,
	children,
}: {
	top: number;
	style?: CSSProperties;
	children?: JSXNode;
}) => (
	<div
		style={{
			position: "absolute",
			left: 0,
			top,
			width: WIDTH,
			display: "flex",
			flexDirection: "column",
			alignItems: "center",
			...style,
		}}
	>
		{children}
	</div>
);
