import React, { useEffect, useRef, useState } from 'react';

export type AboutMeFloatingText = {
	text: string;
	x: number;
	y: number;
	delay?: number; // cuándo inicia
	duration?: number; // vida total del texto
};

interface Props {
	texts: AboutMeFloatingText[];
}

export default function AboutMeFloatingTexts({ texts }: Props) {
	const [time, setTime] = useState(0);
	const raf = useRef<number | null>(null);

	useEffect(() => {
		const start = performance.now();

		const loop = () => {
			setTime(performance.now() - start);
			raf.current = requestAnimationFrame(loop);
		};

		raf.current = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf.current!);
	}, []);

	return (
		<>
			{texts.map((t, i) => {
				// Configuración por defecto
				const delay = t.delay ?? 0;
				const duration = t.duration ?? 4000;

				const fadeInDuration = 600;
				const fadeOutDuration = 800;
				const slideDistance = 40;

				const localTime = time - delay;

				if (localTime < 0) return null; // no apareció aún
				if (localTime > duration) return null; // ya terminó

				let opacity = 1;
				let slideX = 0;
				let fallY = 0;

				// FASE 1: FADE-IN + SLIDE-IN
				if (localTime < fadeInDuration) {
					const p = localTime / fadeInDuration;
					opacity = p;
					slideX = (1 - p) * -slideDistance;
				}

				// FASE 3: FADE-OUT + FALL
				const timeToEnd = duration - localTime;
				if (timeToEnd < fadeOutDuration) {
					const p = 1 - timeToEnd / fadeOutDuration;
					opacity = 1 - p;
					fallY = p * 50; // caída suave
				}

				// Efecto reveal: animar cada letra desde abajo con opacidad progresiva, pero renderizando en línea
				const chars = t.text.split('');
				return (
					<span
						key={i}
						style={{
							position: 'absolute',
							left: t.x,
							top: t.y,
							pointerEvents: 'none',
							fontSize: 32,
							fontWeight: 600,
							color: '#fff',
							whiteSpace: 'pre',
							letterSpacing: 2,
							filter: 'drop-shadow(0 2px 8px #0008)',
							transition: 'none',
							zIndex: 20,
							display: 'inline-block',
						}}
					>
						{chars.map((char, idx) => {
							// Desfase progresivo para cada letra
							const charDelay = idx * 40;
							const charTime = localTime - charDelay;
							let charOpacity = 0;
							let charY = 32;
							if (charTime > 0 && charTime < fadeInDuration) {
								const p = charTime / fadeInDuration;
								charOpacity = p;
								charY = (1 - p) * 32;
							} else if (charTime >= fadeInDuration && charTime < duration - fadeOutDuration) {
								charOpacity = 1;
								charY = 0;
							} else if (charTime >= duration - fadeOutDuration && charTime < duration) {
								const p = 1 - (duration - charTime) / fadeOutDuration;
								charOpacity = 1 - p;
								charY = p * 32;
							}
							return (
								<span
									key={i + '-' + idx}
									style={{
										display: 'inline-block',
										transform: `translateY(${charY}px)`,
										opacity: charOpacity,
										transition: 'none',
									}}
								>
									{char}
								</span>
							);
						})}
					</span>
				);
			})}
		</>
	);
}
