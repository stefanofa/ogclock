/** Escape-by-default HTML templating. Only `html` results are trusted as markup. */

const ESCAPES: Readonly<Record<string, string>> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

export class Html {
	constructor(readonly value: string) {}
}

type Value = Html | string | number | false | null | undefined | readonly Value[];

const render = (value: Value): string => {
	if (value instanceof Html) return value.value;
	if (Array.isArray(value)) return value.map(render).join("");
	if (value === false || value == null) return "";
	return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
};

export const html = (strings: TemplateStringsArray, ...values: Value[]) =>
	new Html(
		strings.reduce((out, text, i) => out + text + (i < values.length ? render(values[i]) : ""), ""),
	);
