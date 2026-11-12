import { describe, expect, it } from "vitest";
import { zone } from "../core/fixtures.ts";
import { zoneCode } from "./link.ts";

describe("zoneCode", () => {
	const edge = zone("Europe/Rome").code;

	it("takes the browser's zone when the table knows it", () => {
		expect(zoneCode("Asia/Tokyo", edge)).toBe(zone("Asia/Tokyo").code);
	});

	it("keeps the edge's guess for a zone the table lacks", () => {
		expect(zoneCode("Mars/Olympus_Mons", edge)).toBe(edge);
	});
});
