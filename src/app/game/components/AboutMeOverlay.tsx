// app/game/components/AboutMeOverlay.tsx
'use client';

import { useEffect, useState } from 'react';
import AnimatedLightWaveText from './AnimatedLightWaveText';
import { useWormholeGrid } from '../hooks/useWormholeGrid';
import HelloSVG from './Hello.svg';

export default function AboutMeOverlay() {
	const [screenH, setScreenH] = useState<number>(0);

	useEffect(() => {
		const update = () => setScreenH(window.innerHeight);
		update();
		window.addEventListener('resize', update);
		return () => window.removeEventListener('resize', update);
	}, []);

	// ✅ SIEMPRE llamamos el hook (orden estable)
	const safeH = screenH > 0 ? screenH : 1;
	const { lines } = useWormholeGrid(safeH, 0.13, 13); // mismo spacing que shader

	// ✅ Recién después decidimos si renderizar o no
	if (screenH <= 0) return null;

	// m = -6..6  → index = m + 6
	const gridMs = [-4, -1, 2, 4];
	const half = 6;

	// (opcional) DEBUG: pintar la grilla
	const DEBUG_GRID = false;

	return (
		<>
			{DEBUG_GRID && (
				<div className="pointer-events-none absolute inset-0 z-50">
					{lines.map((y, i) => (
						<div
							key={i}
							style={{
								position: 'absolute',
								left: 0,
								top: y,
								width: '100%',
								height: 1,
								background: 'rgba(0,255,255,0.18)',
							}}
						/>
					))}
				</div>
			)}

			{gridMs.map((m, i) => (
				<AnimatedLightWaveText
					key={i}
					gridY={lines[m + half]}
					svg={<HelloSVG />}
					duration={4000}
					delay={i * 2000}
				/>
			))}
		</>
	);
}
