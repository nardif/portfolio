'use client';
import { useEffect, useRef, useState } from 'react';
import { GameManager } from '../core/GameManager';

type CanvasProps = {
	onScreenChange?: (id: string | null) => void;
};

export default function Canvas({ onScreenChange }: CanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const managerRef = useRef<GameManager | null>(null);
	const [dimensions, setDimensions] = useState({
		width: 800,
		height: 600,
	});

	useEffect(() => {
		const updateSize = () => {
			setDimensions({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

		updateSize();
		window.addEventListener('resize', updateSize);

		return () => window.removeEventListener('resize', updateSize);
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const manager = new GameManager(canvas, onScreenChange);
		managerRef.current = manager;
		manager.start();

		const onNavigate = (e: Event) => {
			const detail = (e as CustomEvent<{ screenId: string }>).detail;
			if (!detail?.screenId) return;
			managerRef.current?.goToScreen(detail.screenId, { smooth: true });
		};
		window.addEventListener('navigate-screen', onNavigate as EventListener);

		return () => {
			window.removeEventListener('navigate-screen', onNavigate as EventListener);
			manager.dispose();
		};
	}, [dimensions, onScreenChange]);

	return (
		<canvas
			ref={canvasRef}
			width={dimensions.width}
			height={dimensions.height}
			style={{
				display: 'block',
				width: '100vw',
				height: '100vh',
				background: 'transparent',
				position: 'absolute',
				inset: 0,
				zIndex: 10,
			}}
		/>
	);
}
