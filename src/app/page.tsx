// app/game/page.tsx
'use client';
import dynamic from 'next/dynamic';
import GlassNav from './game/components/GlassNav';
import { useState, useEffect } from 'react';
import FloatingTitle from './game/components/FloatingTitle';
import BackgroundShaderStars from './game/components/BackgroundShaderStars';
import BackgroundShaderVapor from './game/components/BackgroundShaderVapor';
import BackgroundShaderWormhole from './game/components/BackgroundShaderWormhole';
import BackgroundShaderUnderwater from './game/components/BackgroundShaderUnderWater';
import BackgroundShaderOceanFloor from './game/components/BackgroundShaderOceanFloor';
import { useOceanFloorAnemone } from './game/hooks/useOceanFloorAnemone';

const Canvas = dynamic(() => import('./game/components/Canvas'), { ssr: false });

export default function GamePage() {
	const [currentScreen, setCurrentScreen] = useState<string | null>(null);
	const [playerData, setPlayerData] = useState<{
		pos: { x: number; y: number };
		vel: { x: number; y: number };
	} | null>(null);

	const safePos = playerData?.pos ?? { x: 0, y: 0 };
	const safeVel = playerData?.vel ?? { x: 0, y: 0 };

	const [wormholeReady, setWormholeReady] = useState(false);
	useEffect(() => {
		const timeout = setTimeout(() => setWormholeReady(true), 100);
		return () => clearTimeout(timeout);
	}, []); //revisar si lo uso

	const { anemoneOpen, isHovering } = useOceanFloorAnemone({
		enabled: currentScreen === 'screen-9-contact',
		center: { x: 0.5, y: 0.42 },
		radius: 0.12,
		durationMs: 700,
	});

	return (
		<div className="relative h-screen w-screen overflow-hidden bg-black text-white">
			<GlassNav />
			{currentScreen === 'screen-1-intro' && (
				<BackgroundShaderStars
					warp={1.08}
					speed={0.75}
					contrast={1.05}
					starDensity={0.9}
					starBrightness={0.95}
					twinkleSpeed={1.0}
				/>
			)}
			{currentScreen === 'screen-1-intro' && (
				<div className="absolute top-28 left-1/2 -translate-x-1/2 text-center z-10 mt-20">
					<FloatingTitle
						text="Portfolio"
						className="font-quivert text-8xl md:text-8xl font-bold tracking-wide drop-shadow-xl"
					/>
				</div>
			)}
			{(currentScreen === 'screen-2-about-me-1' ||
				currentScreen === 'screen-3-about-me-2' ||
				currentScreen === 'screen-4-about-me-3' ||
				currentScreen === 'screen-5-about-me-4') && (
				<BackgroundShaderWormhole
					playerPos={
						playerData ? playerData.pos : { x: window.innerWidth / 2, y: window.innerHeight / 2 }
					}
					playerVel={playerData ? playerData.vel : { x: 0, y: 0 }}
				/>
			)}
			{(currentScreen === 'screen-6-skills-1' || currentScreen === 'screen-7-skills-2') && (
				<BackgroundShaderVapor warp={1.08} speed={0.75} contrast={1.05} />
			)}
			{currentScreen === 'screen-8-projects' && (
				<BackgroundShaderUnderwater
					playerPos={safePos}
					playerVel={safeVel}
					depth={0.75}
					intensity={1.2}
					dprMax={2}
				/>
			)}
			{currentScreen === 'screen-9-contact' && (
				<BackgroundShaderOceanFloor
					playerPos={safePos}
					playerVel={safeVel}
					depth={0.75}
					intensity={1.15}
					anemoneOpen={anemoneOpen}
					anemoneHover={isHovering ? 1 : 0}
				/>
			)}
			<Canvas onScreenChange={setCurrentScreen} onPlayerDataChange={setPlayerData} />
		</div>
	);
}
