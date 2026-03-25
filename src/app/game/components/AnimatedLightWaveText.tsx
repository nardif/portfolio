'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
	/** Y final en CSS px, ya alineada al shader (calculada afuera) */
	gridY: number;
	svg: React.ReactNode;
	duration?: number;
	delay?: number;
};

function easeInOut(t: number) {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

export default function AnimatedLightWaveText({
	gridY,
	svg,
	duration = 4000,
	delay = 0,
}: Props): React.ReactElement | null {
	const [time, setTime] = useState(0);
	const raf = useRef<number | null>(null);

	// Evitar render previo a tener window (por las dudas)
	const [vw, setVw] = useState<number>(0);

	useEffect(() => {
		const onResize = () => setVw(window.innerWidth);
		onResize();
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);

	useEffect(() => {
		const start = performance.now();
		const loop = () => {
			setTime(performance.now() - start - delay);
			raf.current = requestAnimationFrame(loop);
		};
		raf.current = requestAnimationFrame(loop);
		return () => {
			if (raf.current) cancelAnimationFrame(raf.current);
		};
	}, [delay]);

	if (!vw) return null;

	const startX = 0;
	const endX = vw;

	const lineGrowDuration = 800;
	const wavePhaseStart = 800;
	const wavePhaseDuration = 900;
	const revealPhaseStart = wavePhaseStart + wavePhaseDuration;

	const waveAnimProgress = Math.max(0, Math.min(1, (time - wavePhaseStart) / wavePhaseDuration));

	const waveProgress = Math.max(0, Math.min(1, (time - 800) / 1200));
	const revealProgress = Math.max(0, Math.min(1, (time - 2000) / 600));

	const fadeOutDuration = 400;
	const fadeOutProgress = Math.max(
		0,
		Math.min(1, (time - duration + fadeOutDuration) / fadeOutDuration)
	);

	const svgW = endX - startX;
	const svgH = 50;
	const waveCenter = svgW / 2;
	const waveWidth = 300;
	const waveAmp = 18 * waveAnimProgress;
	const waveFreq = 5;

	function getWavePath(amp: number, freq: number) {
		const points: string[] = [];
		const steps = 240;

		for (let i = 0; i <= steps; i++) {
			const x = (svgW * i) / steps;
			let y = svgH / 2;

			const rel = (x - waveCenter) / (waveWidth / 2);
			if (Math.abs(rel) < 1) {
				const envelope = Math.cos(rel * Math.PI) * 0.5 + 0.5;
				y += Math.sin(rel * freq * Math.PI) * amp * envelope;
			}
			points.push(`${x},${y}`);
		}

		return 'M' + points.join(' L');
	}

	const waveX = startX + (endX - startX) * easeInOut(waveProgress);

	return (
		<div
			style={{
				position: 'absolute',
				left: 0,
				top: 0,
				width: '100vw',
				height: '100vh',
				pointerEvents: 'none',
				zIndex: 40,
			}}
		>
			{/* SVG wave line phase */}
			{time >= lineGrowDuration && time < revealPhaseStart && (
				<svg
					width={svgW}
					height={svgH}
					style={{
						position: 'absolute',
						left: startX,
						top: gridY - svgH / 2,
						zIndex: 41,
						filter: 'blur(0.7px)',
					}}
				>
					{[
						{ amp: waveAmp, freq: waveFreq, color: 'rgba(255,230,179,0.85)', width: 3 },
						{ amp: waveAmp * 0.6, freq: waveFreq, color: 'rgba(238, 106, 255, 0.5)', width: 2 },
						{ amp: waveAmp * 0.35, freq: waveFreq, color: 'rgba(255, 185, 64, 0.55)', width: 1.5 },
						{ amp: waveAmp * 0.26, freq: waveFreq, color: 'rgba(255, 116, 36, 0.55)', width: 1.5 },
					].map((w, i) => (
						<path
							key={i}
							d={getWavePath(w.amp, w.freq)}
							stroke={w.color}
							strokeWidth={w.width}
							fill="none"
						/>
					))}
				</svg>
			)}

			{/* Destello/wave animado */}
			{waveProgress > 0 && waveProgress < 1 && (
				<div
					style={{
						position: 'absolute',
						left: waveX - 10,
						top: gridY - 6,
						width: 20,
						height: 12,
						background:
							'radial-gradient(ellipse 60% 40% at 50% 50%, rgb(255,230,179) 60%, rgb(255,179,51) 90%, transparent 100%)',
						opacity: 0.35,
						filter: 'blur(0.8px)',
						borderRadius: '50% 50% 50% 50% / 60% 40% 60% 40%',
						boxShadow: '0 0 4px 1px rgb(255,179,51)',
						zIndex: 41,
					}}
				/>
			)}

			{/* Reveal: solo SVG */}
			{waveProgress >= 1 && fadeOutProgress < 1 && revealProgress > 0 && (
				<span
					style={{
						position: 'absolute',
						left: '50%',
						top: gridY - 50,
						transform: 'translateX(-50%)',
						zIndex: 43,
						opacity: 1 - fadeOutProgress,
						transition: 'opacity 0.3s',
						userSelect: 'none',
						width: 400,
						height: 100,
						display: 'inline-block',
					}}
				>
					{svg}
				</span>
			)}
		</div>
	);
}
