import React, { useEffect, useRef, useState } from 'react';

interface Props {
  spriteY: number;
  text: string;
  duration?: number;
}

export default function LightLineTextReveal({ spriteY, text, duration = 3200 }: Props) {
  const [time, setTime] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const loop = () => {
      setTime(performance.now() - start);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current!);
  }, []);

  // Animación de la línea
  const lineY = spriteY;
  const lineGlow = 1.0;
  const lineFade = Math.max(0, Math.min(1, 1 - time / duration));

  // Animación de texto: fade in letra por letra cuando la línea está en la Y del sprite
  const chars = text.split("");
  const fadeInDuration = 600;
  const fadeOutDuration = 800;
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100vw', height: '100vh', pointerEvents: 'none', zIndex: 30 }}>
      {/* Línea de luz */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: lineY,
          width: '100vw',
          height: 8,
          background: `linear-gradient(90deg, transparent 0%, #3cf8 50%, transparent 100%)`,
          boxShadow: `0 0 32px 8px #3cf8, 0 0 64px 16px #fff`,
          opacity: lineFade,
          filter: `blur(${lineGlow * 2}px)`,
        }}
      />
      {/* Texto sobre la línea */}
      <span
        style={{
          position: 'absolute',
          left: '50%',
          top: lineY - 32,
          transform: 'translateX(-50%)',
          fontSize: 32,
          fontWeight: 600,
          color: '#fff',
          letterSpacing: 2,
          filter: 'drop-shadow(0 2px 16px #3cf8) drop-shadow(0 0px 32px #0ff8)',
          whiteSpace: 'pre',
          zIndex: 31,
        }}
      >
        {chars.map((char, idx) => {
          const charDelay = idx * 40;
          const charTime = time - charDelay;
          let charOpacity = 0;
          if (charTime > 0 && charTime < fadeInDuration) {
            charOpacity = charTime / fadeInDuration;
          } else if (charTime >= fadeInDuration && charTime < duration - fadeOutDuration) {
            charOpacity = 1;
          } else if (charTime >= duration - fadeOutDuration && charTime < duration) {
            const p = 1 - (duration - charTime) / fadeOutDuration;
            charOpacity = 1 - p;
          }
          return (
            <span
              key={idx}
              style={{
                opacity: charOpacity,
                transition: 'none',
                display: 'inline-block',
              }}
            >
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
}
