// /app/game/components/Canvas.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { GameManager } from '../core/GameManager';
import BubbleLabel from './BubbleLabel';

type CanvasProps = { onScreenChange?: (id: string | null) => void };

export default function Canvas({ onScreenChange }: CanvasProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const managerRef = useRef<GameManager | null>(null);
	const [dimensions, setDimensions] = useState({
		width: 800,
		height: 600,
	});
	// Overlay de burbujas
	const [labels, setLabels] = useState<Record<string, { x: number; y: number; text: string }>>({});

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

	// Escuchar eventos de burbujas
	useEffect(() => {
		type BubbleShowDetail = { id: string; x: number; y: number; text: string };
		type BubbleMoveDetail = { id: string; x: number; y: number };
		type BubbleHideDetail = { id: string };

		const onShow = (e: Event) => {
			const { id, x, y, text } = (e as CustomEvent<BubbleShowDetail>).detail;
			setLabels((prev) => ({ ...prev, [id]: { x, y, text } }));
		};
		const onMove = (e: Event) => {
			const { id, x, y } = (e as CustomEvent<BubbleMoveDetail>).detail;
			setLabels((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], x, y } } : prev));
		};
		const onHide = (e: Event) => {
			const { id } = (e as CustomEvent<BubbleHideDetail>).detail;
			setLabels((prev) => {
				const copy = { ...prev };
				delete copy[id];
				return copy;
			});
		};
		window.addEventListener('bubble:show', onShow as EventListener);
		window.addEventListener('bubble:move', onMove as EventListener);
		window.addEventListener('bubble:hide', onHide as EventListener);
		return () => {
			window.removeEventListener('bubble:show', onShow as EventListener);
			window.removeEventListener('bubble:move', onMove as EventListener);
			window.removeEventListener('bubble:hide', onHide as EventListener);
		};
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const manager = new GameManager(canvas, onScreenChange);
		managerRef.current = manager;
		manager.start();

		type NavigateScreenDetail = { screenId: string };
		const onNavigate = (e: Event) => {
			const detail = (e as CustomEvent<NavigateScreenDetail>).detail;
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
		<div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
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
			{/* Overlay de burbujas */}
			<div className="pointer-events-none absolute inset-0 z-20">
				{Object.entries(labels).map(([id, b]) => (
					<BubbleLabel key={id} x={b.x} y={b.y} text={b.text} fontFamily="'Arial', cursive" />
				))}
			</div>
		</div>
	);
}
