// utils/placeCentered.ts

export function placeCentered(
	canvas: HTMLCanvasElement,
	xOffset: number,
	y: number,
	width: number
): number {
	const centerX = canvas.width / 2;
	return centerX + xOffset - width / 2;
}
