import { during } from "../core/hours.ts";
import type { Moment, Weekday } from "../core/moment.ts";
import { AUTO } from "../core/tokens.ts";
import { weekPhase } from "../core/week.ts";
import type { Theme } from "./theme.ts";
import { asleep } from "./themes/asleep.tsx";
import { dayGone } from "./themes/day-gone.tsx";
import { fiveOclock } from "./themes/five-oclock.tsx";
import { themeByCode } from "./themes/index.ts";
import { occasion, once } from "./themes/once.tsx";
import { sunset, sunsetWithin } from "./themes/sunset.tsx";
import { texting } from "./themes/texting.tsx";
import { weekend } from "./themes/weekend.tsx";
import { isYearMilestone, year } from "./themes/year.tsx";

const FRIDAY: Weekday = 5;

/** Auto mode: the theme with the strongest line for this minute. First match wins. */
const DIRECTION: readonly (readonly [(m: Moment) => boolean, Theme])[] = [
	[(m) => occasion(m) !== undefined, once],
	[isYearMilestone, year],
	[during("23:00-02:00"), texting],
	[during("02:00-05:00"), asleep],
	[(m) => sunsetWithin(m, 45), sunset],
	[during("17:00-18:00"), fiveOclock],
	[during("15:00-17:00", [FRIDAY]), fiveOclock],
	[during("18:00-24:00", [FRIDAY]), weekend],
	[(m) => weekPhase(m).kind === "sunday-evening", weekend],
	[() => true, dayGone],
];

export const direct = (m: Moment): Theme => DIRECTION.find(([when]) => when(m))?.[1] ?? dayGone;

/** A link's theme choice, made concrete for one minute. Unknown codes fall back to Auto. */
export const resolveTheme = (code: number, m: Moment): Theme =>
	(code !== AUTO && themeByCode(code)) || direct(m);
