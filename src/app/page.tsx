// app/game/page.tsx
'use client';
import dynamic from 'next/dynamic';
import GlassNav from './game/components/GlassNav';
import { useState } from 'react';
import FloatingTitle from './game/components/FloatingTitle';
import BackgroundShaderStars from './game/components/BackgroundShaderStars';
import BackgroundShaderVapor from './game/components/BackgroundShaderVapor';
import BackgroundShaderWater from './game/components/BackgroundShaderWater';

const Canvas = dynamic(() => import('./game/components/Canvas'), { ssr: false });

export default function GamePage() {
	const [currentScreen, setCurrentScreen] = useState<string | null>(null);

	return (
		<div className="relative h-screen w-screen overflow-hidden bg-black text-white">
			<GlassNav />
			{currentScreen === 'screen-1' && (
				<BackgroundShaderStars
					warp={1.08}
					speed={0.75}
					contrast={1.05}
					starDensity={0.9}
					starBrightness={0.95}
					twinkleSpeed={1.0}
				/>
			)}
			{currentScreen === 'screen-1' && (
				<div className="absolute top-28 left-1/2 -translate-x-1/2 text-center z-10 mt-20">
					<FloatingTitle
						text="Portfolio"
						className="font-quivert text-8xl md:text-8xl font-bold tracking-wide drop-shadow-xl"
					/>
				</div>
			)}
			{currentScreen === 'screen-2' && (
				<BackgroundShaderVapor warp={1.08} speed={0.75} contrast={1.05} palette={0} />
			)}
			{currentScreen === 'screen-3' && <BackgroundShaderWater />}
			<Canvas onScreenChange={setCurrentScreen} />
		</div>
	);
}
