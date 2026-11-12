import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AUTO } from "../core/tokens.ts";
import { THEMES } from "../og/themes/index.ts";
import type { Minute } from "../web/protocol.ts";
import { bindings, slots } from "../web/slots.ts";
import { initial } from "../web/state.ts";
import { tiles } from "./page.ts";

/** The slot keys every tag in `markup` binds, parsed the way both renderers parse them. */
const keysIn = (markup: string) =>
	[...markup.matchAll(/<[^>]+>/g)].flatMap(([tag]) =>
		bindings({
			get: (name) => new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null,
			set: () => {},
			text: () => {},
			image: () => {},
		}).map(([key]) => key),
	);

describe("shell", () => {
	const minute: Minute = {
		instant: 0,
		zone: 0,
		auto: 1,
		themes: THEMES.map(({ code, id, name }) => ({ code, id, name, line: name, image: "" })),
	};
	const values = slots(
		initial(
			{
				host: "ogclock.app",
				zone: 0,
				link: "",
				theme: AUTO,
				received: false,
				serverNow: 0,
				now: { minute, next: minute },
			},
			0,
		),
	);

	it("binds only slots the page fills", () => {
		const shell = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
		const keys = keysIn(shell + tiles(minute.themes).value);
		expect(keys).toEqual(expect.arrayContaining(["time", "notice-hidden", "checked-0", "thumb-1"]));
		expect(keys.filter((key) => !(key in values))).toEqual([]);
	});

	it("rejects a binding it cannot parse", () => {
		expect(() => keysIn('<p data-attr="hidden">')).toThrow(/malformed/);
		expect(() => keysIn('<p data-attr="hidden=a=b">')).toThrow(/malformed/);
		expect(() => keysIn('<p data-text="">')).toThrow(/malformed/);
	});
});
