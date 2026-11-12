/** A seeded random stream (mulberry32): the same seed always draws the same numbers. */
export const random = (seed: number) => {
	let state = seed >>> 0;
	const next = () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return {
		next,
		between: (min: number, max: number) => min + (max - min) * next(),
		/** Normally distributed, by Box–Muller. */
		gauss: (mean: number, sd: number) =>
			mean + sd * Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()),
	};
};
