/**
 * The world map's projection: equirectangular, the full 360° of longitude across the image,
 * cropped to the latitudes people live at. scripts/land.ts draws the coastline with it and
 * themes draw anything else (the night) with the same numbers.
 */
export const MAP_WIDTH = 1200;
const MAP_NORTH = 84;
export const MAP_SOUTH = -56;

/** Pixels per degree. */
const K = MAP_WIDTH / 360;

export const project = (lon: number, lat: number): readonly [x: number, y: number] => [
	(lon + 180) * K,
	(MAP_NORTH - lat) * K,
];
