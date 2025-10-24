export function wrapTextLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number
): string[] {
	const words = text.split(/\s+/);
	const lines: string[] = [];
	let line = '';

	for (let i = 0; i < words.length; i++) {
		const test = line ? line + ' ' + words[i] : words[i];
		const w = ctx.measureText(test).width;

		if (w <= maxWidth) {
			line = test;
		} else {
			if (line) lines.push(line);
			// Si una palabra sola excede maxWidth, la “forzamos” en línea propia
			// (opcional: partir por caracteres si querés extra finura)
			line = words[i];
		}
	}
	if (line) lines.push(line);
	return lines;
}
