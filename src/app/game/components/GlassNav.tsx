'use client';
import { useState } from 'react';

type NavItem = { label: string; screenId: string };

const NAV: NavItem[] = [
	{ label: 'Home', screenId: 'screen-1-intro' },
	{ label: 'About', screenId: 'screen-2-about-me-1' },
	{ label: 'Skills', screenId: 'screen-6-skills-1' },
	{ label: 'Projects', screenId: 'screen-8-projects' },
	{ label: 'Contact', screenId: 'screen-9-contact' },
];

export default function GlassNav() {
	const [active, setActive] = useState<number | null>(null);

	const navigateTo = (screenId: string) => {
		window.dispatchEvent(new CustomEvent('navigate-screen', { detail: { screenId } }));
	};

	return (
		<nav className="fixed left-1/2 top-6 z-20 -translate-x-1/2">
			{/* Glass container */}
			<div
				className="
          group
          flex items-center gap-1
          rounded-2xl border border-white/20
          bg-white/10
          shadow-lg shadow-black/10
          px-2 py-1
          backdrop-blur-md
          supports-[backdrop-filter]:bg-white/10
          transition-all duration-300
          hover:bg-white/12
        "
			>
				{NAV.map((item, i) => (
					<button
						key={item.label}
						onMouseEnter={() => setActive(i)}
						onMouseLeave={() => setActive((x) => (x === i ? null : x))}
						onClick={() => navigateTo(item.screenId)}
						className="
              relative
              overflow-hidden
              rounded-xl
              px-3 py-2
              text-sm md:text-base
              text-white/90
              transition-all duration-300
              hover:text-white
              focus:outline-none
              focus-visible:ring-2 focus-visible:ring-white/40
            "
					>
						{/* Hover glow behind each item */}
						<span
							className={`
                pointer-events-none absolute inset-0 -z-10
                rounded-xl
                bg-gradient-to-b from-white/15 to-white/5
                opacity-0 transition-opacity duration-300
                ${active === i ? 'opacity-100' : 'group-hover:opacity-60 hover:opacity-100'}
              `}
						/>
						{/* Label */}
						<span className="relative">{item.label}</span>
						{/* Underline reveal on hover */}
						<span
							className={`
                pointer-events-none absolute left-3 right-3 -bottom-0.5
                h-px bg-white/70
                origin-left scale-x-0
                transition-transform duration-300
                ${active === i ? 'scale-x-100' : 'group-hover:scale-x-50 hover:scale-x-100'}
              `}
						/>
					</button>
				))}
			</div>
		</nav>
	);
}
