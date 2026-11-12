import { writeFile } from "node:fs/promises";

/** The first four bytes of each font format the scripts fetch. */
const SIGNATURES = {
	ttf: ["\0\x01\0\0", "true", "OTTO"],
	woff2: ["wOF2"],
} as const;

export const fetchOk = async (url: string, init?: RequestInit) => {
	const res = await fetch(url, init);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText} from ${url}`);
	return res;
};

/**
 * Writes the font at `url` to `file`, only once its bytes are one: later runs skip files that
 * exist, so an error page saved by mistake would stay bundled.
 */
export const downloadFont = async (url: string, file: URL, format: keyof typeof SIGNATURES) => {
	const bytes = await (await fetchOk(url)).bytes();
	const signature = String.fromCharCode(...bytes.subarray(0, 4));
	if (!SIGNATURES[format].some((expected) => expected === signature)) {
		throw new Error(`${url} is not ${format}: it starts with ${JSON.stringify(signature)}`);
	}
	await writeFile(file, bytes);
	return bytes.byteLength;
};
