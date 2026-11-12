import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { card } from "./card.tsx";
import { nodeEngine } from "./engine.node.ts";
import { createRenderer } from "./render.ts";

describe("renderer", () => {
	it("starts the engines again after a failed start", async () => {
		const engine = await nodeEngine();
		const broken = createRenderer({ ...engine, resvg: new Uint8Array([0, 1, 2, 3]) });
		await expect(broken(card)).rejects.toThrow();
		const png = await createRenderer(engine)(card);
		expect(png.byteLength).toBeGreaterThan(0);
	});

	it("ships the brand card exactly as card.tsx draws it (pnpm gen:card)", async () => {
		const committed = await readFile(new URL("./card.png.bin", import.meta.url));
		const drawn = await createRenderer(await nodeEngine())(card);
		expect(Buffer.from(drawn).equals(committed)).toBe(true);
	});
});
