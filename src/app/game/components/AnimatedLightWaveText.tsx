import React, { useEffect, useRef, useState } from 'react';

interface Props {
	spriteY: number;
	spriteX?: number;
	text: string;
	duration?: number;
	delay?: number;
}

// Utilidad para ease in/out
function easeInOut(t: number) {
	return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// Utilidad: obtener posiciones Y alineadas con la grilla del shader
export function getGridLineYs(screenH: number, count: number = 13) {
	const lines: number[] = [];
	const center = screenH / 2;
	const spacing = screenH * 0.13;
	for (let m = -Math.floor(count / 2); m <= Math.floor(count / 2); m++) {
		lines.push(center + m * spacing);
	}
	return lines;
}
export default function AnimatedLightWaveText({
	spriteY,
	text,
	duration = 4000,
	delay = 0,
}: Props): React.ReactElement {
	// --- SVG wave animation phase ---
	const [time, setTime] = useState(0);
	const raf = useRef<number | null>(null);

	const wavePhaseStart = 800;
	const wavePhaseDuration = 900;
	const revealPhaseStart = wavePhaseStart + wavePhaseDuration; // 1700ms
	const waveAnimProgress = Math.max(0, Math.min(1, (time - wavePhaseStart) / wavePhaseDuration));

	// Declarar primero para poder usarlas en la lógica de la línea
	const screenW = window.innerWidth;
	const startX = 0;
	const endX = screenW;

	// SVG params
	const lineY = spriteY;
	const svgW = endX - startX;
	const svgH = 50;
	const waveCenter = svgW / 2;
	const waveWidth = Math.max(180, text.length * 22);
	const waveAmp = 18 * waveAnimProgress;
	const waveFreq = 5;

	function getWavePath(amp: number, freq: number) {
		const points = [];
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

	useEffect(() => {
		const start = performance.now();
		const loop = () => {
			setTime(performance.now() - start - delay);
			raf.current = requestAnimationFrame(loop);
		};
		raf.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf.current!);
	}, [delay]);

	// Parámetros de animación
	const lineGrowDuration = 800; // línea crece al aparecer
	const lineShrinkStart = 2000; // ms, cuando termina el delay y empieza el reveal
	const lineShrinkDuration = 1000; // ms, duración del shrink
	const waveProgress = Math.max(0, Math.min(1, (time - 800) / 1200)); // destello recorre la línea
	const revealProgress = Math.max(0, Math.min(1, (time - 2000) / 600)); // texto aparece
	// Fade-out clásico: 400ms
	const fadeOutDuration = 400;
	const fadeOutProgress = Math.max(
		0,
		Math.min(1, (time - duration + fadeOutDuration) / fadeOutDuration)
	);

	// Línea principal: crece desde la izquierda, luego el borde izquierdo se mueve hacia la derecha tras el delay
	let lineLength = 1;
	let lineLeft = startX;
	if (time < lineGrowDuration) {
		// Crece de 0 a 1
		lineLength = Math.min(1, time / lineGrowDuration);
		lineLeft = startX;
	} else if (time >= lineShrinkStart) {
		// El borde izquierdo se mueve hacia la derecha
		const shrinkElapsed = time - lineShrinkStart;
		if (shrinkElapsed < lineShrinkDuration) {
			const shrinkP = shrinkElapsed / lineShrinkDuration;
			lineLength = 1 - shrinkP;
			lineLeft = startX + (endX - startX) * shrinkP;
		} else {
			lineLength = 0;
			lineLeft = endX;
		}
	}

	const waveX = startX + (endX - startX) * easeInOut(waveProgress);

	// Render
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
						top: lineY - svgH / 2,
						zIndex: 41,
						filter: 'blur(0.7px)',
					}}
				>
					{[
						{ amp: waveAmp, freq: waveFreq, color: 'rgba(255,230,179,0.85)', width: 3 },
						{
							amp: waveAmp * 0.6,
							freq: waveFreq,
							color: 'rgba(238, 106, 255, 0.5)',
							width: 2,
						},
						{
							amp: waveAmp * 0.35,
							freq: waveFreq,
							color: 'rgba(255, 185, 64, 0.55)',
							width: 1.5,
						},
						{
							amp: waveAmp * 0.26,
							freq: waveFreq,
							color: 'rgba(255, 116, 36, 0.55)',
							width: 1.5,
						},
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
						top: spriteY - 6,
						width: 20,
						height: 12,
						background:
							'radial-gradient(ellipse 60% 40% at 50% 50%, rgb(255,230,179) 60%, rgb(255,179,51) 90%, transparent 100%)',
						opacity: 0.35,
						filter: 'blur(0.8px)',
						borderRadius: '50% 50% 50% 50% / 60% 40% 60% 40%',
						boxShadow: '0 0 4px 1px rgb(255,179,51)',
						zIndex: 41,
						transition: 'all 0.2s',
					}}
				/>
			)}
			{/* Sound wave/rombo + texto reveal */}
			{waveProgress >= 1 && fadeOutProgress < 1 && revealProgress > 0 && (
				<span
					style={{
						position: 'absolute',
						left: '50%',
						top: spriteY - 16,
						transform: 'translateX(-50%)',
						fontSize: 32,
						fontWeight: 600,
						color: '#fff',
						letterSpacing: 2,
						textShadow: '0 2px 8px #222, 0 0px 16px rgb(255,230,179), 0 0px 32px rgb(255,179,51)',
						whiteSpace: 'pre',
						zIndex: 43,
						opacity: 1 - fadeOutProgress,
						transition: 'opacity 0.3s',
						userSelect: 'none',
						fontFamily: 'Arial Black, Arial, sans-serif',
					}}
				>
					{text.split('').map((char, idx) => {
						const charDelay = idx * 40;
						const charTime = time - 2000 - charDelay;
						let charOpacity = 0;
						if (charTime > 0 && charTime < 600) {
							charOpacity = charTime / 600;
						} else if (charTime >= 600 && fadeOutProgress < 1) {
							charOpacity = 1 - fadeOutProgress;
						}
						return (
							<span
								key={idx}
								style={{
									opacity: charOpacity,
									transition: 'opacity 0.2s',
									display: 'inline-block',
								}}
							>
								{char}
							</span>
						);
					})}
				</span>
			)}
			{/* Línea se borra progresivamente al final */}
			{fadeOutProgress < 1 && fadeOutProgress > 0 && (
				<div
					style={{
						position: 'absolute',
						left: waveX,
						top: spriteY,
						width: endX - waveX,
						height: 3,
						background: 'linear-gradient(90deg, rgb(255,230,179) 0%, transparent 100%)',
						opacity: 0.7 * (1 - fadeOutProgress),
						borderRadius: 2,
						filter: 'blur(0.7px)',
						transition: 'width 0.2s, opacity 0.2s',
						pointerEvents: 'none',
						display: fadeOutProgress <= 0 || fadeOutProgress >= 1 ? 'none' : undefined,
					}}
				/>
			)}
		</div>
	);
}
