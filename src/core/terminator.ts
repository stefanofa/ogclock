import { subsolarPoint } from "./sun.ts";

const RAD = Math.PI / 180;

/** Degrees of the sun above the horizon at lat/lon, given where it stands overhead. */
export const elevation = (
	sub: { readonly lat: number; readonly lon: number },
	lat: number,
	lon: number,
): number =>
	Math.asin(
		Math.sin(lat * RAD) * Math.sin(sub.lat * RAD) +
			Math.cos(lat * RAD) * Math.cos(sub.lat * RAD) * Math.cos((lon - sub.lon) * RAD),
	) / RAD;

/**
 * Where the sun is below an elevation: a cap of the globe centred opposite the sun, 90° plus
 * that elevation in radius. Elevation 0 is the night; -6 and -12 are past civil and nautical dusk.
 */
export interface Darkness {
	/**
	 * The cap's rim as [lon, lat], ending where it began. Longitude starts in [-180, 180) and never
	 * jumps, so a rim around a pole ends 360° east or west of its start.
	 */
	readonly edge: readonly (readonly [lon: number, lat: number])[];
	/** The pole inside the cap, if any. The darkness is then everything between the rim and it. */
	readonly pole: "north" | "south" | undefined;
}

const POINTS = 360;

const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

export const darkness = (instant: number, elevationDeg: number): Darkness => {
	const sun = subsolarPoint(instant);
	const lat0 = -sun.lat * RAD;
	const lon0 = sun.lon + 180;
	const radius = (90 + elevationDeg) * RAD;
	const edge: (readonly [number, number])[] = [];
	for (let i = 0; i <= POINTS; i++) {
		const bearing = (i / POINTS) * 2 * Math.PI;
		const lat = Math.asin(
			Math.sin(lat0) * Math.cos(radius) + Math.cos(lat0) * Math.sin(radius) * Math.cos(bearing),
		);
		const lon =
			lon0 +
			Math.atan2(
				Math.sin(bearing) * Math.sin(radius) * Math.cos(lat0),
				Math.cos(radius) - Math.sin(lat0) * Math.sin(lat),
			) /
				RAD;
		const previous = edge.at(-1)?.[0] ?? 0;
		edge.push([previous + wrap(lon - previous), lat / RAD]);
	}
	const dark = (lat: number) => elevation(sun, lat, 0) < elevationDeg;
	return { edge, pole: dark(90) ? "north" : dark(-90) ? "south" : undefined };
};
