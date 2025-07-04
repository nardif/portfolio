'use client';           //hooks del lado cliente

import { animated, useSpring } from '@react-spring/web';
import { useEffect, useState } from 'react';

const sections = [
  { image: '/assets/close0.jpg' },
  { image: '/assets/close1.jpg' },
  { image: '/assets/close2.jpg' },
  { image: '/assets/close3.jpg' },
];

export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(1000);

  useEffect(() => {         //para que el height de la window sea responsive y dinamico
    const updateSize = () => setViewportHeight(window.innerHeight);
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);          //captura scroll real time
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const longSectionHeight = viewportHeight * 3;         //cada imagen dura 3 pantallas
  const totalHeight = longSectionHeight * sections.length;

  return (
    <div className="relative w-full overflow-hidden bg-black">
      {/* Planeta 1 sobre close0 (sección 0) */}
      <div
        style={{
          position: 'absolute',
          top: `${0 * longSectionHeight}px`,
          width: '100%',
          height: longSectionHeight,
          pointerEvents: 'none',
          zIndex: 10
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            width: '100%',
            height: '100vh',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center'
          }}
        >
          <img
              src="/platforms/planet.png"
            alt="planet-top"
            style={{ width: 300, marginBottom: 40 }}
          />
        </div>
      </div>

      {sections.map((section, index) => {           //render de la imagen
        const isLast = index === sections.length - 1;

        const sectionStart = isLast
          ? longSectionHeight * (sections.length - 1)
          : index * longSectionHeight;

        const sectionEnd = isLast
          ? totalHeight
          : sectionStart + longSectionHeight;

        const sectionDuration = sectionEnd - sectionStart;
        const rawProgress = (scrollY - sectionStart) / sectionDuration;
        const progress = Math.min(Math.max(rawProgress, 0), 1);

        const isVisible = scrollY >= sectionStart && scrollY < sectionEnd;

        const transform = isLast            //zoom por imagen
          ? `scale(${1.1 - 0.1 * progress})`
          : `scale(${1.5 - 0.5 * progress})`;

        const opacity = isLast
          ? Math.min(progress * 1.5, 1)         //fade-in rapido
          : isVisible
          ? 1
          : 0;

        const blur = isLast
          ? 0
          : progress < 0.87
            ? 0
            : Math.min(((progress - 0.87) / 0.13) * 5, 5);

        const spring = useSpring({          //aplica las animaciones
          transform,
          opacity,
          filter: `blur(${blur}px)`,
          config: { tension: 120, friction: 20 },
        });

        return (
          <animated.div
            key={index}
            style={{
              ...spring,
              backgroundImage: `url(${section.image})`,
              zIndex: sections.length - index,
            }}
            className="fixed top-0 left-0 w-full h-screen bg-cover bg-center origin-center will-change-transform pointer-events-none"
          />
        );
      })}
      {/* Sprite Pikmin */}

      {/* Planeta 2 sobre close2 (sección 2) */}
        <div
          style={{
            position: 'absolute',
            top: `${2 * longSectionHeight}px`,
            width: '100%',
            height: longSectionHeight,
            pointerEvents: 'none',
            zIndex: 10
          }}
        >
          <div
            style={{
              position: 'sticky',
              top: 0,
              width: '100%',
              height: '100vh',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center'
            }}
          >
            <img
              src="/platforms/planet.png"
              alt="planet-bottom"
              style={{ width: 300, marginBottom: 40 }}
            />
          </div>
        </div>
      {/* Scroll container */}
      <div style={{ height: `${totalHeight}px` }} />
    </div>
  );
}
