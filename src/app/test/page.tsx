'use client';

import BackgroundShaderRed from './BackgroundShaderRed';

export default function TestPage() {
	return (
		<div className="relative w-screen h-screen bg-black">
			<BackgroundShaderRed />
			<div className="absolute top-10 left-10 z-10 text-white text-xl">
				Test Shader Page – Debe verse un fondo rojo
			</div>
		</div>
	);
}
