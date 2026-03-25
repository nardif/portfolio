'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Options = {
	enabled: boolean;
	center?: { x: number; y: number };
	radius?: number;
	durationMs?: number;
	cursorPointer?: boolean;

	// Ajustes finos
	ellipseX?: number; // hit más ancho en X
	ellipseY?: number; // hit un poco menos en Y
};

export function useOceanFloorAnemone({
	enabled,
	center = { x: 0.5, y: 0.42 },
	radius = 0.12,
	durationMs = 700,
	cursorPointer = true,
	ellipseX = 1.15,
	ellipseY = 0.95,
}: Options) {
	const [anemoneOpen, setAnemoneOpen] = useState(0);
	const [isHovering, setIsHovering] = useState(false);

	const openedOnceRef = useRef(false);
	const animatingRef = useRef(false);
	const isHoveringRef = useRef(false);

	const hitTest = useCallback(
		(clientX: number, clientY: number) => {
			const w = Math.max(1, window.innerWidth);
			const h = Math.max(1, window.innerHeight);

			const x = clientX / w;
			const y = 1.0 - clientY / h;

			// aspect como shader
			const aspect = w / h;

			let dx = x - center.x;
			let dy = y - center.y;

			// aspect correction + elipse
			dx *= aspect * ellipseX;
			dy *= ellipseY;

			const dist = Math.sqrt(dx * dx + dy * dy);
			return dist <= radius;
		},
		[center.x, center.y, radius, ellipseX, ellipseY]
	);

	const openOnce = useCallback(() => {
		if (openedOnceRef.current) return;
		if (animatingRef.current) return;

		openedOnceRef.current = true;
		animatingRef.current = true;

		const start = performance.now();

		const tick = () => {
			const t = Math.min(1, (performance.now() - start) / durationMs);
			const eased = t * t * (3 - 2 * t);
			setAnemoneOpen(eased);

			if (t < 1) requestAnimationFrame(tick);
			else animatingRef.current = false;
		};

		requestAnimationFrame(tick);
	}, [durationMs]);

	const handleClick = useCallback(
		(e: PointerEvent) => {
			if (!enabled) return;
			if (openedOnceRef.current) return;

			if (hitTest(e.clientX, e.clientY)) openOnce();
		},
		[enabled, hitTest, openOnce]
	);

	const handleMove = useCallback(
		(e: PointerEvent) => {
			if (!enabled) return;

			if (openedOnceRef.current) {
				if (isHoveringRef.current) {
					isHoveringRef.current = false;
					setIsHovering(false);
				}
				if (cursorPointer) document.body.style.cursor = 'default';
				return;
			}

			const wantHover = hitTest(e.clientX, e.clientY);

			if (wantHover !== isHoveringRef.current) {
				isHoveringRef.current = wantHover;
				setIsHovering(wantHover);
			}

			if (cursorPointer) {
				document.body.style.cursor = wantHover ? 'pointer' : 'default';
			}
		},
		[enabled, hitTest, cursorPointer]
	);

	useEffect(() => {
		if (!enabled) return;

		window.addEventListener('pointermove', handleMove, { passive: true });
		window.addEventListener('pointerdown', handleClick);

		return () => {
			window.removeEventListener('pointermove', handleMove);
			window.removeEventListener('pointerdown', handleClick);

			if (cursorPointer) document.body.style.cursor = 'default';

			isHoveringRef.current = false;
			setIsHovering(false);
		};
	}, [enabled, handleClick, handleMove, cursorPointer]);

	return {
		anemoneOpen,
		isOpened: openedOnceRef.current,
		isHovering,
	};
}
