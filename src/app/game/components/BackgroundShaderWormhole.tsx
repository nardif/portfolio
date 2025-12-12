'use client';
import { useEffect, useRef } from 'react';

type Vec2 = { x: number; y: number };

type Props = {
	playerPos: Vec2;
	playerVel: Vec2;
	dprMax?: number; // limitar DPR por performance
};

export default function BackgroundShaderWormhole({ playerPos, playerVel, dprMax = 2 }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const playerPosRef = useRef(playerPos);
	const playerVelRef = useRef(playerVel);

	// Mantener refs actualizados
	playerPosRef.current = playerPos;
	playerVelRef.current = playerVel;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
		if (!gl) {
			console.warn('WebGL no disponible');
			return;
		}

		// ===== VERTEX SHADER =====
		const vertSrc = `
      attribute vec2 aPos;
      void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

		// ===== FRAGMENT SHADER (wormhole + hipérbolas) =====
		const fragSrc = `
      precision highp float;
      precision mediump int;

      uniform float uTime;
      uniform vec2  uRes;

      // posición y velocidad del sprite (normalizadas 0..1)
      uniform vec2 uPlayerPos;
      uniform vec2 uPlayerVelocity;

      float hash(float n) { return fract(sin(n) * 43758.5453123); }

      mat2 rot(float a) {
        float c = cos(a), s = sin(a);
        return mat2(c, -s, s, c);
      }

      void main() {
        vec2 fragCoord = gl_FragCoord.xy;

        vec2 uv0 = fragCoord / uRes; // uv normalizado (0..1)
        vec2 p = (fragCoord - 0.5 * uRes) / uRes.y; // coords centradas y aspect ratio

        float time = uTime;

        // Centro del túnel influido por el sprite
        float spriteX = uPlayerPos.x;
        vec2 tunnelCenter = vec2((spriteX - 0.5) * (uRes.x / uRes.y), 0.0);
        vec2 q = p - tunnelCenter;

        // Profundidad del túnel
        float r = length(q);
        float angle = atan(q.y, q.x);
        float depth = 1.0 / (0.15 + r * 1.8);

        // Rotación global del túnel
        angle += time * 0.5;

        // Deformación por velocidad del sprite
        vec2 vel = uPlayerVelocity;
        float velMag = clamp(length(vel) / 800.0, 0.0, 1.5);
        vec2 velDir = (length(vel) > 0.001) ? normalize(vel) : vec2(0.0, -1.0);

        // Inclinación según velocidad (afecta al túnel)
        q *= rot(velDir.x * 0.5 * velMag);

        // Recomputa r/angle tras deformar
        r = length(q);
        angle = atan(q.y, q.x) + time * 0.7;

        // Dos ramas de hipérbola centradas en el sprite
        float a = 0.25;
        float b = 0.18;
        float width = 0.006;
        float hyper = 0.0;
        float spriteSizeX = 0.04; // tamaño relativo del sprite en X
        float margin = 2.0 * spriteSizeX;
        float spriteCenterX = 0.0; // sprite en el centro visual (q.x=0)

        // Líneas verticales (hipérbolas)
        float newMargin = margin * 0.4;
        float openAngle = 0.3;
        for(float i = -35.0; i <= 35.0; i += 1.0) {
          float offset = i * 0.055;
          float flash = 0.5 + 0.5 * sin(uTime * 7.0 + i * 1.2 + q.y * 6.0);
          float line = 0.0;
          // Curvas izquierda solo en mitad izquierda
          if (q.x < spriteCenterX - newMargin) {
            float d = abs(q.x - offset + a * openAngle * sqrt(1.0 + (q.y / b)*(q.y / b)));
            if (offset < 0.0) {
              line = exp(-d / width) * flash;
            }
          }
          // Curvas derecha solo en mitad derecha
          if (q.x > spriteCenterX + newMargin) {
            float d = abs(q.x - offset - a * openAngle * sqrt(1.0 + (q.y / b)*(q.y / b)));
            if (offset > 0.0) {
              line = exp(-d / width) * flash;
            }
          }
          hyper += line;
        }

        // Líneas tipo "warp speed" convergiendo al centro
        float warpLines = 0.0;
        for (float k = -12.0; k <= 12.0; k += 1.0) {
          float angle = k * 0.13 + sin(uTime * 0.7 + k) * 0.05;
          float rWarp = length(q);
          float xCurve = rWarp * cos(angle);
          float yCurve = rWarp * sin(angle);
          float curve = abs(q.x - xCurve) + abs(q.y - yCurve);
          float speedAnim = 0.5 + 0.5 * sin(uTime * 2.5 + k * 1.5 + rWarp * 8.0);
          float line = exp(-curve / (0.012 + 0.008 * speedAnim)) * speedAnim;
          warpLines += line;
        }
        warpLines = clamp(warpLines, 0.0, 1.0);
        // Líneas verticales rectas (rejilla)
        float grid = 0.0;
        for (float j = -6.0; j <= 6.0; j += 1.0) {
          float xGrid = j * 0.13;
          float d = abs(q.x - xGrid);
          float flash = 0.5 + 0.5 * sin(uTime * 2.5 + j * 1.5 + q.y * 6.0);
          grid += exp(-d / width) * flash;
        }
        // Líneas horizontales (diagonales)
        for (float m = -6.0; m <= 6.0; m += 1.0) {
          float yGrid = m * 0.13;
          float d = abs(q.y - yGrid);
          float flash = 0.5 + 0.5 * sin(uTime * 2.5 + m * 1.5 + q.x * 6.0);
          grid += exp(-d / width) * flash * 0.7;
        }
        // Elipses horizontales repetidas en varias posiciones Y
        float ellipseA = 0.7; // semieje x
        float ellipseB = 0.25; // semieje y
        for (float r = 0.15; r < 0.7; r += 0.07) {
          for (float yShift = -0.6; yShift <= 0.6; yShift += 0.14) {
            float d = abs((q.x * q.x) / (ellipseA * ellipseA) + ((q.y - yShift) * (q.y - yShift)) / (ellipseB * ellipseB) - r);
            float flash = 0.5 + 0.5 * sin(uTime * 7.0 + q.y * 6.0);
            grid += exp(-d / width) * flash * 0.5;
          }
        }
        hyper = clamp(hyper, 0.0, 1.0);
        grid = clamp(grid, 0.0, 1.0);

        // Glow central
        float centerGlow = exp(-length(q) * 7.0) * 1.2;

        // Fondo violeta/azul oscuro
        vec3 bg = mix(vec3(0.05, 0.01, 0.10), vec3(0.08, 0.02, 0.18), q.y * 0.5 + 0.5);

        // Color de líneas: blanco-amarillo
        vec3 gridColor = mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 0.7, 0.2), q.y * 0.5 + 0.5);
        vec3 col = bg;
        col = mix(col, gridColor, hyper * 0.8 + grid * 0.5);
        col += centerGlow * vec3(1.0, 0.9, 0.7);

        // Destellos pequeños en cruz
        float flashes = 0.0;
        for (float s = 0.0; s < 5.0; s += 1.0) {
          float sx = fract(s * 0.23 + 0.37);
          float sy = fract(s * 0.41 + 0.19);
          vec2 starPos = vec2(sx, sy);
          vec2 d = uv0 - starPos;
          float anim = 0.3 + 0.3 * sin(uTime * 3.0 + s * 2.0);
          float size = 0.006 + anim * 0.004;
          float cross = exp(-abs(d.x) / size) + exp(-abs(d.y) / size);
          cross *= exp(-dot(d, d) / (size * 8.0));
          flashes += cross * anim;
        }
        col += flashes * vec3(1.0, 0.95, 0.8) * 0.35;

        // Viñeta
        float vign = smoothstep(1.15, 0.35, length(uv0 - 0.5));
        col *= vign;

        gl_FragColor = vec4(col, 1.0);
      }
    `;

		// ---- helpers ----
		const createShader = (type: number, src: string) => {
			const sh = gl.createShader(type)!;
			gl.shaderSource(sh, src);
			gl.compileShader(sh);
			if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
				console.error('Shader compile error:', gl.getShaderInfoLog(sh));
			}
			return sh;
		};

		const vs = createShader(gl.VERTEX_SHADER, vertSrc);
		const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
			console.error('Program link error:', gl.getProgramInfoLog(prog));
		}
		gl.useProgram(prog);

		// quad fullscreen
		const aPos = gl.getAttribLocation(prog, 'aPos');
		const quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

		// uniforms
		const uTimeLoc = gl.getUniformLocation(prog, 'uTime');
		const uResLoc = gl.getUniformLocation(prog, 'uRes');
		const uPlayerPosLoc = gl.getUniformLocation(prog, 'uPlayerPos');
		const uPlayerVelLoc = gl.getUniformLocation(prog, 'uPlayerVelocity');

		// resize con DPR
		const resize = () => {
			const dpr = Math.min(dprMax, window.devicePixelRatio || 1);
			const w = Math.max(1, Math.floor(window.innerWidth));
			const h = Math.max(1, Math.floor(window.innerHeight));
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			gl.viewport(0, 0, canvas.width, canvas.height);
		};
		resize();
		window.addEventListener('resize', resize);

		let raf = 0;
		const start = performance.now();

		const loop = () => {
			const t = (performance.now() - start) / 1000;

			gl.useProgram(prog);

			gl.uniform1f(uTimeLoc, t);
			gl.uniform2f(uResLoc, canvas.width, canvas.height);

			// Usar los valores actuales de los refs
			const pos = playerPosRef.current;
			const vel = playerVelRef.current;
			const px = window.innerWidth > 0 ? pos.x / window.innerWidth : 0.5;
			const py = window.innerHeight > 0 ? 1.0 - pos.y / window.innerHeight : 0.5;
			gl.uniform2f(uPlayerPosLoc, px, py);
			gl.uniform2f(uPlayerVelLoc, vel.x, vel.y);

			gl.clearColor(0.0, 0.0, 0.0, 0.0); // fondo transparente
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	}, [dprMax]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 z-0"
			style={{ background: 'transparent' }}
		/>
	);
}
