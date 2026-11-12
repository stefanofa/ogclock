/** Past this many pixels down, letting go closes the sheet; short of it, the sheet springs back. */
const CLOSE_PX = 72;

/** Lets a bottom sheet follow a downward drag that starts on its header. */
export const dragToClose = (sheet: HTMLElement, close: () => void) => {
	const handle = sheet.querySelector<HTMLElement>(".sheet-head");
	if (!handle) return;
	let start: number | undefined;
	let dy = 0;

	const move = (event: PointerEvent) => {
		if (start === undefined) return;
		dy = Math.max(0, event.clientY - start);
		sheet.style.translate = `0 ${dy}px`;
	};
	const end = () => {
		if (start === undefined) return;
		start = undefined;
		sheet.classList.remove("dragging");
		sheet.style.translate = "";
		removeEventListener("pointermove", move);
		if (dy > CLOSE_PX) close();
	};

	handle.addEventListener("pointerdown", (event) => {
		if (!event.isPrimary || event.button !== 0) return;
		start = event.clientY;
		dy = 0;
		sheet.classList.add("dragging");
		addEventListener("pointermove", move);
		addEventListener("pointerup", end, { once: true });
		addEventListener("pointercancel", end, { once: true });
	});
};
