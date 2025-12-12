// app/game/page.tsx
'use client';
import dynamic from 'next/dynamic';
import GlassNav from './game/components/GlassNav';
import { useState, useEffect } from 'react';
import FloatingTitle from './game/components/FloatingTitle';
import BackgroundShaderStars from './game/components/BackgroundShaderStars';
//import BackgroundShaderNeonTunnel from './game/components/BackgroundShaderNeonTunnel';
import BackgroundShaderVapor from './game/components/BackgroundShaderVapor';
import BackgroundShaderWater from './game/components/BackgroundShaderWater';
import BackgroundShaderWormhole from './game/components/BackgroundShaderWormhole';
import BackgroundShaderWormholeSimplified from './game/components/BackgroundShaderWormholeSimplified';

const Canvas = dynamic(() => import('./game/components/Canvas'), { ssr: false });

export default function GamePage() {
	const [currentScreen, setCurrentScreen] = useState<string | null>(null);
	const [playerData, setPlayerData] = useState<{
		pos: { x: number; y: number };
		vel: { x: number; y: number };
	} | null>(null);

	const [wormholeReady, setWormholeReady] = useState(false);
	useEffect(() => {
		const timeout = setTimeout(() => setWormholeReady(true), 100);
		return () => clearTimeout(timeout);
	}, []);

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
			{currentScreen === 'screen-8-projects' && <BackgroundShaderWater />}
			<Canvas onScreenChange={setCurrentScreen} onPlayerDataChange={setPlayerData} />
		</div>
	);
}
