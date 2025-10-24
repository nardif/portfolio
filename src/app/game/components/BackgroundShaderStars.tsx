'use client';
import { useEffect, useRef } from 'react';

type Props = {
	warp?: number; // 1.00–1.20  (distorsión nebulosa)
	speed?: number; // 0.5–1.2    (velocidad global)
	contrast?: number; // 0.9–1.2    (curva nebulosa)
	starDensity?: number; // 0.6–1.2    (cantidad de estrellas)
	starBrightness?: number; // 0.6–1.1    (intensidad estrellas)
	twinkleSpeed?: number; // 0.6–1.4    (velocidad parpadeo)
	dprMax?: number; // limitar DPR (1.5–2) por perf
};

export default function BackgroundShaderStars({
	warp = 1.08,
	speed = 0.75,
	contrast = 1.05,
	starDensity = 0.95,
	starBrightness = 0.95,
	twinkleSpeed = 1.0,
	dprMax = 2,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current!;
		// Forzamos WebGL1 para máxima compatibilidad
		const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
		if (!gl) {
			console.warn('WebGL no disponible');
			return;
		}

		const vertSrc = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

		// ===== FRAGMENT SHADER =====
		const fragSrc = `
			#extension GL_OES_standard_derivatives : enable
      precision highp float;
      precision mediump int;

      uniform float uTime;
      uniform vec2  uRes;
      uniform float uWarp;
      uniform float uSpeed;
      uniform float uContrast;

      uniform float uStarDensity;
      uniform float uStarBrightness;
      uniform float uTwinkleSpeed;

      // ---------- Hash/Noise/FBM ----------
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        float a = hash(i + vec2(0.0,0.0));
        float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0));
        float d = hash(i + vec2(1.0,1.0));
        return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i=0; i<5; i++) {
          v += a * noise(p);
          p = m * p * 1.18;
          a *= 0.55;
        }
        return v;
      }

      // ---------- Paleta ----------
      vec3 palette(float t) {
        vec3 c1 = vec3(0.02, 0.03, 0.10);
        vec3 c2 = vec3(0.08, 0.28, 0.55);
        vec3 c3 = vec3(0.65, 0.85, 1.00);
        return mix(c1, c2, smoothstep(0.2, 0.85, t)) + 0.10*vec3(smoothstep(0.7,1.0,t));
      }

      // ---------- Estrellas en píxeles con AA ----------
      float rand2(vec2 n){ return fract(sin(dot(n, vec2(12.9898,78.233))) * 43758.5453); }

      // 'cell' en PÍXELES
      float starLayer(vec2 fragPx, float cell, float time, float density) {
        vec2 p  = fragPx / cell;
        vec2 ip = floor(p);
        vec2 fp = fract(p);

        float chance = 1.0 - (0.06 + 0.22 * density);
        if (rand2(ip) < chance) return 0.0;

        vec2  sp     = vec2(rand2(ip+11.1), rand2(ip+27.2));
        float sizePx = mix(0.8, 1.8, rand2(ip+91.7));

        float dPx = length((fp - sp) * cell);
        float core = smoothstep(sizePx, sizePx*0.5, dPx);

        float tw = 0.5 + 0.5 * sin(time * (2.0 + 3.0 * rand2(ip+7.7)) + rand2(ip) * 6.2831);
        tw = pow(tw, 1.8);

        return core * tw;
      }

      void main() {
        // uv0: normalizado (0..1) sin estirar
        vec2 uv0 = gl_FragCoord.xy / uRes.xy;
        // uv: estirado solo para nebulosa
        vec2 uv = uv0;
        uv.x *= uRes.x / uRes.y;

        float t = uTime * uSpeed;

        // ---------- Nebulosa (domain warping) ----------
        vec2 q = uv * 2.0;
        q.y += sin(uv.x * 3.0 + t*0.7) * 0.12;
        q.x += cos(uv.y * 2.4 - t*0.9) * 0.10;

        vec2 r = q;
        r += uWarp * vec2(
          fbm(q + vec2(0.0, t*0.22)),
          fbm(q + vec2(t*0.18, 1.0))
        );

        float n1 = fbm(r*1.25 - vec2(0.0, t*0.05));
        float n2 = fbm(r*2.10 + vec2(t*0.06, 0.0));
        float neb = mix(n1, n2, 0.35);
        neb = pow(clamp(neb, 0.0, 1.0), uContrast);

        vec3 nebCol = palette(neb);

        // ---------- Estrellas (en píxeles, AA, con parpadeo) ----------
        mat2 rot = mat2(cos(0.15), -sin(0.15), sin(0.15), cos(0.15));
        vec2 center = 0.5 * uRes;
        vec2 fragPx = rot * (gl_FragCoord.xy - center) + center;

        float s = 0.0;
        s += starLayer(fragPx + vec2( 13.4,  -7.9),  6.0,  uTime * uTwinkleSpeed * 1.00, uStarDensity);
        s += 0.8 * starLayer(fragPx + vec2(-25.0,   5.0),  9.0,  uTime * uTwinkleSpeed * 1.05, uStarDensity);
        s += 0.6 * starLayer(fragPx + vec2( 40.0, -18.0), 12.0,  uTime * uTwinkleSpeed * 0.95, uStarDensity);

        vec3 col = nebCol + vec3(1.0) * (s * uStarBrightness);

        // Viñeta suave con uv0 (no estirado)
        float vign = smoothstep(1.12, 0.58, length(uv0 - 0.5));
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

		// quad
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
		const uTime = gl.getUniformLocation(prog, 'uTime');
		const uRes = gl.getUniformLocation(prog, 'uRes');
		const uWarpLoc = gl.getUniformLocation(prog, 'uWarp');
		const uSpeedLoc = gl.getUniformLocation(prog, 'uSpeed');
		const uContrastLoc = gl.getUniformLocation(prog, 'uContrast');
		const uStarDensityLoc = gl.getUniformLocation(prog, 'uStarDensity');
		const uStarBrightnessLoc = gl.getUniformLocation(prog, 'uStarBrightness');
		const uTwinkleSpeedLoc = gl.getUniformLocation(prog, 'uTwinkleSpeed');

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

			gl.uniform1f(uTime, t);
			gl.uniform2f(uRes, canvas.width, canvas.height);
			gl.uniform1f(uWarpLoc, warp);
			gl.uniform1f(uSpeedLoc, speed);
			gl.uniform1f(uContrastLoc, contrast);
			gl.uniform1f(uStarDensityLoc, starDensity);
			gl.uniform1f(uStarBrightnessLoc, starBrightness);
			gl.uniform1f(uTwinkleSpeedLoc, twinkleSpeed);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	}, [warp, speed, contrast, starDensity, starBrightness, twinkleSpeed, dprMax]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 z-0"
			style={{ background: 'transparent' }}
		/>
	);
}
