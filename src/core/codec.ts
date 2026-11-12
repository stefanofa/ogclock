/**
 * Composable fixed-width binary codecs. Small combinators build typed values into
 * one bigint, and `text` turns any codec into a short, canonical, URL-safe string.
 */

export interface Codec<A> {
	readonly bits: number;
	readonly pack: (value: A) => bigint;
	/** Returns undefined for any value that pack could not have produced. */
	readonly unpack: (packed: bigint) => A | undefined;
}

const mask = (bits: number) => (1n << BigInt(bits)) - 1n;

export const uint = (bits: number): Codec<number> => {
	const max = 2 ** bits - 1;
	return {
		bits,
		pack: (value) => {
			if (!Number.isInteger(value) || value < 0 || value > max) {
				throw new RangeError(`${value} does not fit in ${bits} bits`);
			}
			return BigInt(value);
		},
		unpack: (packed) => Number(packed & mask(bits)),
	};
};

/** Raw bits, for values wider than a float can hold exactly (nonces). */
export const bits = (width: number): Codec<bigint> => ({
	bits: width,
	pack: (value) => {
		if (value < 0n || value > mask(width))
			throw new RangeError(`value does not fit in ${width} bits`);
		return value;
	},
	unpack: (packed) => packed & mask(width),
});

/** A field that must hold exactly one value, such as a format version. */
export const literal = <V extends number>(codec: Codec<number>, value: V): Codec<V> => ({
	bits: codec.bits,
	pack: () => codec.pack(value),
	unpack: (packed) => (codec.unpack(packed) === value ? value : undefined),
});

/** Adapts a codec to a richer type. `decode` returning undefined rejects the token. */
export const map = <A, B>(
	codec: Codec<A>,
	decode: (a: A) => B | undefined,
	encode: (b: B) => A,
): Codec<B> => ({
	bits: codec.bits,
	pack: (value) => codec.pack(encode(value)),
	unpack: (packed) => {
		const a = codec.unpack(packed);
		return a === undefined ? undefined : decode(a);
	},
});

type Fields<T> = { readonly [K in keyof T]: Codec<T[K]> };

/** Packs fields most-significant first, in declaration order. */
export const struct = <T extends object>(fields: Fields<T>): Codec<T> => {
	const entries = Object.entries(fields) as [keyof T & string, Codec<unknown>][];
	return {
		bits: entries.reduce((sum, [, codec]) => sum + codec.bits, 0),
		pack: (value) =>
			entries.reduce(
				(packed, [key, codec]) => (packed << BigInt(codec.bits)) | codec.pack(value[key]),
				0n,
			),
		unpack: (packed) => {
			const out = {} as Record<string, unknown>;
			let rest = packed;
			for (const [key, codec] of [...entries].reverse()) {
				const field = codec.unpack(rest & mask(codec.bits));
				if (field === undefined) return undefined;
				out[key] = field;
				rest >>= BigInt(codec.bits);
			}
			return out as T;
		},
	};
};

/** Crockford base32, lowercase: no i, l, o or u, so links survive being read aloud. */
const ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";
const DIGITS = new Map([...ALPHABET].map((char, index) => [char, BigInt(index)]));

export interface TextCodec<A> {
	readonly length: number;
	readonly encode: (value: A) => string;
	/** Strict: wrong length, foreign characters or non-canonical padding all return undefined. */
	readonly decode: (text: string) => A | undefined;
}

export const text = <A>(codec: Codec<A>): TextCodec<A> => {
	const length = Math.ceil(codec.bits / 5);
	return {
		length,
		encode: (value) => {
			let packed = codec.pack(value);
			let out = "";
			for (let i = 0; i < length; i++) {
				out = ALPHABET[Number(packed & 31n)] + out;
				packed >>= 5n;
			}
			return out;
		},
		decode: (input) => {
			if (input.length !== length) return undefined;
			let packed = 0n;
			for (const char of input) {
				const digit = DIGITS.get(char);
				if (digit === undefined) return undefined;
				packed = (packed << 5n) | digit;
			}
			if (packed >> BigInt(codec.bits) !== 0n) return undefined;
			return codec.unpack(packed);
		},
	};
};
