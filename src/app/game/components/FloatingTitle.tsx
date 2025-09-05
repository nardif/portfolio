'use client';
import { useEffect, useState } from 'react';
import { useSprings, animated, SpringUpdateFn } from '@react-spring/web';

type FloatingTitleProps = {
	text: string;
	className?: string;
	delay?: number;
};

export default function FloatingTitle({ text, className = '', delay = 0 }: FloatingTitleProps) {
	const [active, setActive] = useState(false);

	const springs = useSprings(
		text.length,
		text.split('').map((_, i) => ({
			from: { transform: 'translateY(0px)' },
			to: async (next: SpringUpdateFn<{ transform: string }>) => {
				while (true) {
					await next({ transform: 'translateY(-8px)' });
					await next({ transform: 'translateY(8px)' });
					await next({ transform: 'translateY(-4px)' });
					await next({ transform: 'translateY(0px)' });
				}
			},
			delay: delay + i * 80, //desfasado por letra
			config: { mass: 1, tension: 120, friction: 10 },
			pause: !active,
		}))
	);

	useEffect(() => {
		setActive(true); // activa animaciones después del montaje
	}, []);

	return (
		<h1 className={`flex justify-center space-x-1 ${className}`}>
			{text.split('').map((char, i) => (
				<animated.span key={i} style={springs[i]} className="relative inline-block group">
					<span className="absolute inset-0 -z-10 blur-xl opacity-50 text-white transition duration-500 group-hover:opacity-100">
						{char === ' ' ? '\u00A0' : char}
					</span>
					{char === ' ' ? '\u00A0' : char}
				</animated.span>
			))}
		</h1>
	);
}
