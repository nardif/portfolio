// /src/app/game/components/BubbleLabel.tsx
'use client';

type Props = { x: number; y: number; text: string; fontFamily?: string };

export default function BubbleLabel({ x, y, text, fontFamily }: Props) {
	return (
		<div
			className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none"
			style={{ left: x, top: y }}
		>
			<div
				className="relative flex items-center justify-center"
				style={{
					width: 130,
					height: 130,
					clipPath: 'circle(50% at 50% 50%)',
					background:
						'radial-gradient(ellipse at top left,rgba(255,255,255,0.18),rgba(180,220,255,0.08) 45%,rgba(20,40,60,0.06) 100%)',
					border: '1.5px solid rgba(255,255,255,0.20)',
					boxShadow: '0 0 25px rgba(120,200,255,0.25)',
					overflow: 'hidden',
					animation: 'bubbleBreath 2.2s ease-in-out infinite',
				}}
			>
				{/* halos internos */}
				<div
					className="pointer-events-none absolute inset-0 rounded-full opacity-60"
					style={{
						background:
							'radial-gradient(120% 100% at 20% 0%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0.1) 22%, rgba(120,200,255,0.10) 52%, transparent 70%)',
					}}
				/>
				{/* sheen */}
				<div
					className="pointer-events-none absolute -inset-1 rounded-full opacity-0 mix-blend-screen animate-sheen"
					style={{
						background:
							'linear-gradient(115deg, transparent 30%, rgba(190,240,255,0.45) 50%, transparent 70%)',
					}}
				/>
				{/* rim light */}
				<div
					className="pointer-events-none absolute inset-0 rounded-full"
					style={{
						boxShadow:
							'inset 0 0 40px rgba(160,220,255,0.25), inset 0 0 10px rgba(255,255,255,0.5)',
					}}
				/>
				{/* contenido */}
				<span
					className="z-20 text-white/95 text-center leading-snug whitespace-pre-wrap select-none"
					style={{
						fontFamily: 'Arial',
						fontWeight: 'bold',
						fontSize: 22,
						maxWidth: 110,
						maxHeight: 110,
						overflow: 'hidden',
						wordBreak: 'break-word',
						pointerEvents: 'none',
						display: 'block',
					}}
				>
					{text}
				</span>
			</div>
			{/* glow exterior */}
			<div
				className="pointer-events-none absolute -z-10 rounded-full blur-2xl opacity-60"
				style={{
					inset: '-20% -15%',
					background:
						'radial-gradient(60% 60% at 50% 40%, rgba(90,160,255,0.35), rgba(40,100,180,0.15), transparent 70%)',
				}}
			/>
			<style>{`
				@keyframes bubbleBreath {
					0% {
						transform: scale(1);
						filter: drop-shadow(0 0 0 rgba(160, 220, 255, 0.25));
					}
					50% {
						transform: scale(1.04);
						filter: drop-shadow(0 0 12px rgba(160, 220, 255, 0.35));
					}
					100% {
						transform: scale(1);
						filter: drop-shadow(0 0 0 rgba(160, 220, 255, 0.25));
					}
				}
				@keyframes sheen {
					0% {
						opacity: 0;
						transform: translateX(-20%) rotate(5deg);
					}
					35% {
						opacity: 1;
					}
					70% {
						opacity: 0;
						transform: translateX(20%) rotate(5deg);
					}
					100% {
						opacity: 0;
						transform: translateX(20%) rotate(5deg);
					}
				}
			`}</style>
		</div>
	);
}
