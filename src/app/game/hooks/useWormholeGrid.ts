// app/game/hooks/useWormholeGrid.ts
'use client';
import { useMemo } from 'react';

export function useWormholeGrid(screenH: number, spacingFactor = 0.13, count = 13) {
	return useMemo(() => {
		const centerY = screenH / 2;
		const spacing = spacingFactor * screenH;

		const lines: number[] = [];
		const half = Math.floor(count / 2);

		for (let m = -half; m <= half; m++) {
			lines.push(centerY + m * spacing);
		}

		return {
			centerY,
			spacing,
			lines,
		};
	}, [screenH, spacingFactor, count]);
}
