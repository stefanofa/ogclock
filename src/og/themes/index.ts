import type { Theme } from "../theme.ts";
import { asleep } from "./asleep.tsx";
import { dayGone } from "./day-gone.tsx";
import { fiveOclock } from "./five-oclock.tsx";
import { once } from "./once.tsx";
import { sunset } from "./sunset.tsx";
import { texting } from "./texting.tsx";
import { weekend } from "./weekend.tsx";
import { year } from "./year.tsx";

/** Every theme, in the order the picker shows them. */
export const THEMES: readonly Theme[] = [
	dayGone,
	texting,
	weekend,
	once,
	year,
	sunset,
	asleep,
	fiveOclock,
];

const byCode = new Map(THEMES.map((theme) => [theme.code, theme]));

export const themeByCode = (code: number) => byCode.get(code);
