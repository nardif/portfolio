// app/game/shaders/BackgroundShaderWormhole.tsx
'use client';
import { useEffect, useRef } from 'react';
import { WormholePatternRenderer } from '../render/WormholePatternRenderer';

type Vec2 = { x: number; y: number };

type Props = {
	playerPos: Vec2; // CSS px (coordenadas de pantalla)
	playerVel: Vec2; // px-ish
	dprMax?: number;
};

export default function BackgroundShaderWormhole({ playerPos, playerVel, dprMax = 2 }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const playerPosRef = useRef(playerPos);
	const playerVelRef = useRef(playerVel);

	// Optional smoothing: set to 0 to disable (use same value for RT + final pass).
	const SMOOTHING = 0.0; // 0.0 = off, 0.1..0.25 = soft

	// internal smoothed px X (framebuffer px)
	const smoothedPxXRef = useRef<number | null>(null);

	playerPosRef.current = playerPos;
	playerVelRef.current = playerVel;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl', {
			alpha: true,
			antialias: false,
			premultipliedAlpha: false,
		}) as WebGLRenderingContext | null;
		if (!gl) {
			console.warn('WebGL no disponible');
			return;
		}

		const vertSrc = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

		// Final fragment shader: centrar túnel con uPlayerPx (framebuffer px).
		// El pattern RT contiene la "respiración"/tilt por velocidad; el final pass solo samplea RT en q-space.
		const fragSrc = `
precision highp float;

uniform float uTime;
uniform vec2  uRes;
uniform vec2  uPlayerPx;      // framebuffer px
uniform sampler2D uPatternTex;
uniform vec2  uPatternRes;

varying vec2 vUv;

float hash2d(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash2d(i);
  float b = hash2d(i + vec2(1.0, 0.0));
  float c = hash2d(i + vec2(0.0, 1.0));
  float d = hash2d(i + vec2(1.0, 1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}

float fbm(vec2 p){
  float v = 0.0;
  float a = 0.55;
  mat2 m = mat2(1.6, -1.2, 1.2, 1.6);
  for(int i=0;i<5;i++){
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v;
}

vec3 gradeArcane(vec3 col){
  col = pow(col, vec3(0.92));
  col = (col - 0.5) * 1.12 + 0.5;
  col = vec3(col.r*0.92, col.g*1.02, col.b*1.08);
  return clamp(col, 0.0, 1.0);
}

vec3 addHalation(vec3 col, vec3 tint, float m){
  float core = pow(m, 1.25);
  float halo = pow(m, 0.55);
  col = mix(col, tint, core);
  col += tint * 0.35 * halo;
  col += tint * 0.18 * halo*halo;
  return col;
}

void main() {
  vec2 uv0 = vUv;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y; // pixel->space centered

  float t = uTime;

  float aspect = uRes.x / uRes.y;

  // sprite center in same space as p:
  vec2 spriteCenter = (uPlayerPx - 0.5 * uRes) / uRes.y;
  spriteCenter.y = 0.0; // Y fixed (tunnel only follows X)

  vec2 q = p - spriteCenter;
  float r0 = length(q);

  // wobble only affects sampling (no translation)
  float wob = (fbm(q*6.0 + t*0.18) - 0.5) * 0.018 + (fbm(q*11.0 + vec2(t*0.11, -t*0.08)) - 0.5) * 0.010;

  // sample RT in q-space (keep aspect)
  vec2 qs = q;
  qs.x /= max(1e-4, aspect);

  float tunnelScale = 1.10;
  vec2 tuv = qs / tunnelScale + 0.5;

  // NO Y drift. small wobble for breathing
  tuv += wob * vec2(0.35, 0.25);

  tuv.x = fract(tuv.x);
  tuv.y = clamp(tuv.y, 0.0, 1.0);

  vec2 texel = 1.0 / max(uPatternRes, vec2(1.0));
  float pat =
    0.55 * texture2D(uPatternTex, tuv).r +
    0.15 * texture2D(uPatternTex, tuv + texel * vec2( 1.0, 0.0)).r +
    0.15 * texture2D(uPatternTex, tuv + texel * vec2(-1.0, 0.0)).r +
    0.15 * texture2D(uPatternTex, tuv + texel * vec2( 0.0, 1.0)).r;

  float lineMask = pow(smoothstep(0.10, 0.90, pat), 1.10);
  float breaks = smoothstep(0.18, 0.92, fbm(q*14.0 + t*0.08));
  lineMask *= mix(0.82, 1.06, breaks);

  // background + compositing
  vec3 bgA = vec3(0.04, 0.01, 0.10);
  vec3 bgB = vec3(0.06, 0.02, 0.16);
  vec3 col = mix(bgA, bgB, smoothstep(0.0, 1.0, uv0.y));

  float mist = fbm(uv0*2.0 + vec2(0.0, t*0.03));
  mist = smoothstep(0.25, 0.85, mist);
  col += mist * vec3(0.015, 0.018, 0.026);

  float centerGlow = exp(-r0 * 6.2) * (0.85 + 0.35*fbm(q*4.0 + t*0.2));
  vec3 inkCore = vec3(1.00, 0.82, 0.38);
  vec3 inkHalo = vec3(0.65, 0.25, 0.10);

  col = addHalation(col, inkCore, lineMask);
  col += inkHalo * pow(lineMask, 0.55) * 0.22;
  col += inkCore * lineMask * smoothstep(0.95, 0.18, r0) * 0.11;
  col += centerGlow * inkCore * (0.42 + 0.22 * (1.0 / (0.15 + r0 * 1.8)));

  float paint = fbm(uv0*8.0 + vec2(t*0.01, -t*0.012));
  col *= mix(0.90, 1.10, paint);

  float grain = hash2d(uv0 * uRes + fract(t)*1000.0);
  col += (grain - 0.5) * 0.024;

  float v = length(uv0 - 0.5);
  float vign = smoothstep(1.35, 0.25, v);
  col *= (0.78 + 0.22 * vign);

  col = gradeArcane(col);
  gl_FragColor = vec4(col, 1.0);
}
`;

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

		gl.deleteShader(vs);
		gl.deleteShader(fs);

		const quad = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);

		const aPos = gl.getAttribLocation(prog, 'aPos');
		const uTimeLoc = gl.getUniformLocation(prog, 'uTime');
		const uResLoc = gl.getUniformLocation(prog, 'uRes');
		const uPlayerPxLoc = gl.getUniformLocation(prog, 'uPlayerPx');
		const uPatternTexLoc = gl.getUniformLocation(prog, 'uPatternTex');
		const uPatternResLoc = gl.getUniformLocation(prog, 'uPatternRes');

		// RT: ancho x alto para no deformar (ratio wide)
		const pattern = new WormholePatternRenderer(gl, 720, 432, 2);

		const bindQuad = () => {
			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			gl.enableVertexAttribArray(aPos);
			gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
		};

		const resize = () => {
			const dpr = Math.min(dprMax, window.devicePixelRatio || 1);
			const w = Math.max(1, Math.floor(window.innerWidth));
			const h = Math.max(1, Math.floor(window.innerHeight));
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			canvas.width = Math.max(1, Math.floor(w * dpr));
			canvas.height = Math.max(1, Math.floor(h * dpr));
			gl.viewport(0, 0, canvas.width, canvas.height);

			const rtW = Math.floor(Math.min(1024, canvas.width * 0.55));
			const rtH = Math.floor(Math.min(768, canvas.height * 0.55));
			pattern.resizeRT(rtW, rtH);
		};

		resize();
		window.addEventListener('resize', resize);

		let raf = 0;
		const start = performance.now();

		const loop = () => {
			const t = (performance.now() - start) / 1000;
			const pos = playerPosRef.current;
			const vel = playerVelRef.current;

			// ----- SINGLE SOURCE OF TRUTH: framebuffer px -----
			const rect = canvas.getBoundingClientRect();
			const dprX = canvas.width / rect.width; // DPR effective X
			const px = (pos.x - rect.left) * dprX;
			const py = (pos.y - rect.top) * (canvas.height / rect.height); // kept if needed

			// optional smoothing (applies to px X only)
			let finalPxX = px;
			if (SMOOTHING > 0.0) {
				if (smoothedPxXRef.current === null) smoothedPxXRef.current = px;
				smoothedPxXRef.current = smoothedPxXRef.current + (px - smoothedPxXRef.current) * SMOOTHING;
				finalPxX = smoothedPxXRef.current;
			}

			// normalized 0..1 based on framebuffer width — USE THIS EXACT VALUE for RT + final
			const spriteX01 = canvas.width > 0 ? finalPxX / canvas.width : 0.5;

			// 1) RT pass (use SAME normalized X that we'll use in final pass)
			pattern.render(t, spriteX01, { x: vel.x, y: vel.y });

			// 2) Final pass
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, canvas.width, canvas.height);

			gl.useProgram(prog);
			bindQuad();

			gl.uniform1f(uTimeLoc, t);
			gl.uniform2f(uResLoc, canvas.width, canvas.height);

			// Provide player center in framebuffer px coordinates (pixel-perfect)
			const playerPxVecX = finalPxX;
			const playerPxVecY = canvas.height * 0.5; // Y fixed at center of screen
			gl.uniform2f(uPlayerPxLoc, playerPxVecX, playerPxVecY);

			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, pattern.rt.tex);
			gl.uniform1i(uPatternTexLoc, 0);
			gl.uniform2f(uPatternResLoc, pattern.rt.width, pattern.rt.height);

			gl.disable(gl.DEPTH_TEST);
			gl.disable(gl.BLEND);

			gl.clearColor(0.0, 0.0, 0.0, 0.0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			raf = requestAnimationFrame(loop);
		};

		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
			pattern.destroy();
			gl.deleteBuffer(quad);
			gl.deleteProgram(prog);
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
