'use client';
import { useEffect, useRef } from 'react';

type Vec2 = { x: number; y: number };

type Props = {
	playerPos: Vec2;
	playerVel: Vec2;

	// Control artístico
	depth?: number; // 0..1
	intensity?: number; // 0..2

	dprMax?: number;
};

export default function BackgroundShaderUnderwater({
	playerPos,
	playerVel,
	depth = 0.5,
	intensity = 1.0,
	dprMax = 2,
}: Props) {
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
      varying vec2 vUv;
      void main() {
        vUv = aPos * 0.5 + 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;

		// ===== FRAGMENT SHADER =====
		const fragSrc = `
			precision highp float;

			uniform float uTime;
			uniform vec2  uRes;

			uniform vec2  uPlayerPos;       // 0..1 (y invertida ya desde JS)
			uniform vec2  uPlayerVelocity;  // pantallas/seg (ideal), escalada en JS
			uniform float uDepth;           // 0..1
			uniform float uIntensity;       // 0..2

			varying vec2 vUv;

			// ---------- noise helpers ----------
			float hash1(float n){ return fract(sin(n) * 43758.5453123); }

			float hash(vec2 p){
				p = fract(p * vec2(123.34, 456.21));
				p += dot(p, p + 45.32);
				return fract(p.x * p.y);
			}

			float noise(vec2 p){
				vec2 i = floor(p);
				vec2 f = fract(p);
				float a = hash(i);
				float b = hash(i + vec2(1.0, 0.0));
				float c = hash(i + vec2(0.0, 1.0));
				float d = hash(i + vec2(1.0, 1.0));
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

			// painterly “brush” modulation
			float painterly(vec2 uv, float t){
				vec2 p = uv;
				p.x *= 1.25;
				p.y *= 0.85;

				float n1 = fbm(p*6.0 + vec2(0.0, t*0.15));
				float n2 = fbm((p + vec2(n1*0.08, -n1*0.06))*14.0 + vec2(t*0.08, 0.0));
				float strokes = smoothstep(0.25, 0.85, n2);

				float paper = fbm(uv*40.0 + t*0.02);
				paper = smoothstep(0.15, 0.95, paper);

				return mix(strokes, strokes*paper, 0.45);
			}

			// ---------- Voronoi Caustics (web / edges) ----------
			vec2 hash2(vec2 p){
				float n = sin(dot(p, vec2(127.1, 311.7)));
				float m = sin(dot(p, vec2(269.5, 183.3)));
				return fract(vec2(n, m) * 43758.5453);
			}

			float voronoi(vec2 x){
				vec2 n = floor(x);
				vec2 f = fract(x);
				float md = 10.0;

				for(int j=-1;j<=1;j++){
					for(int i=-1;i<=1;i++){
						vec2 g = vec2(float(i), float(j));
						vec2 o = hash2(n + g);
						// animate points
						o = 0.5 + 0.5*sin(uTime*0.6 + 6.2831*o);
						vec2 r = g + o - f;
						float d = dot(r,r);
						md = min(md, d);
					}
				}
				return md;
			}

			float caustics(vec2 uv){
				// escala: más alto = más detalle / menos blobs
				vec2 p = uv * vec2(10.0, 7.0);
				p += vec2(0.0, -uTime*0.28);

				// ligera distorsión para que no sea “perfecto”
				p += (fbm(uv*3.0 + uTime*0.12) - 0.5) * 0.35;

				float v = voronoi(p);

				// distancia -> líneas
				float c = 1.0 - smoothstep(0.015, 0.16, v);
				c = pow(c, 2.3);

				// imperfección/pincel
				c *= 0.75 + 0.25*fbm(uv*18.0 + uTime*0.15);

				return c;
			}

			// godrays verticales con jitter
			float godrays(vec2 uv, float t, float depth){
				float y = uv.y;
				float fade = smoothstep(1.0, 0.15, y);

				float bands = fbm(vec2(uv.x*3.0, t*0.08))*0.6 + fbm(vec2(uv.x*7.0, t*0.03))*0.4;
				bands = smoothstep(0.35, 0.9, bands);

				float jitter = fbm(uv*10.0 + vec2(0.0, t*0.2));
				bands *= (0.7 + 0.3*jitter);

				float atten = mix(1.0, 0.55, depth);
				return bands * fade * atten;
			}

			vec3 colorGrade(vec3 col){
				col = pow(col, vec3(0.95));
				col = vec3(col.r * 0.86, col.g * 1.05, col.b * 1.10);
				col = (col - 0.5) * 1.10 + 0.5;
				return clamp(col, 0.0, 1.0);
			}

			void main(){
				vec2 uv = vUv;
				vec2 px = gl_FragCoord.xy / uRes.xy;

				float t = uTime;
				float depth = clamp(uDepth, 0.0, 1.0);
				float inten = max(uIntensity, 0.0);

				// Vel ya viene escalada desde JS; clamp por seguridad
				vec2 vel = clamp(uPlayerVelocity, vec2(-2.0), vec2(2.0));

				// Influencia del jugador (más refracción cerca)
				float d = distance(uv, uPlayerPos);
				float influence = smoothstep(0.60, 0.06, d);

				// Corriente + refracción
				vec2 flowDir = normalize(vec2(0.2, -1.0) + vel*1.2);
				float flowNoise = fbm(uv*4.0 + t*0.2);
				vec2 flow = flowDir * (0.010 + 0.020*flowNoise) * (0.22 + 0.78*influence);

				float wave = fbm(uv*2.2 + vec2(t*0.05, -t*0.04));
				vec2 refractUv = uv + flow + (wave - 0.5) * 0.018 * (0.6 + 0.5*inten);

				// Refracción extra
				float wobble = fbm(uv*6.0 + vec2(t*0.20, -t*0.18));
				refractUv += (wobble - 0.5) * 0.010 * (0.6 + 0.4*inten);

				// ---------- Base + fog ----------
				vec3 deepCol    = vec3(0.02, 0.07, 0.08);
				vec3 shallowCol = vec3(0.05, 0.22, 0.24);

				float y = refractUv.y; // 1 arriba, 0 abajo
				vec3 base = mix(deepCol, shallowCol, smoothstep(0.0, 1.0, y));

				// Fog: menos agresivo + más claro (evita negro abajo)
				float fogStrength = mix(0.9, 2.0, depth);
				float fog = 1.0 - exp(-fogStrength * (1.0 - y));
				vec3 fogColor = vec3(0.04, 0.16, 0.17);
				base = mix(base, fogColor, fog * (0.38 + 0.25*inten));

				// Surface scattering
				float surface = exp(-pow((1.0 - y) * 3.0, 2.0));
				base += surface * vec3(0.10, 0.34, 0.32) * (0.30 + 0.45*inten) * (1.0 - 0.55*depth);

				// ---------- Caústicas + rayos ----------
				float c = caustics(refractUv) * (0.75 + 0.25*(1.0-depth));
				float r = godrays(refractUv, t, depth) * 0.55;

				// Caústicas sólo arriba
				float causticMask = smoothstep(0.78, 1.0, refractUv.y);

				vec3 causticCol = vec3(0.08, 0.40, 0.38) * c * causticMask;
				vec3 raysCol    = vec3(0.06, 0.20, 0.20) * r;

				vec3 col = base + causticCol * (0.95 + 0.55*inten) + raysCol * (0.55 + 0.30*inten);

				// ---------- #5 Surface line ----------
				float surfaceLine = smoothstep(0.90, 1.0, refractUv.y);
				float rip = fbm(refractUv*vec2(8.0, 2.0) + vec2(t*0.25, 0.0));
				surfaceLine *= smoothstep(0.45, 0.70, rip);
				col += surfaceLine * vec3(0.10, 0.30, 0.28) * 0.35;

				// ---------- Painterly ----------
				float paint = painterly(refractUv + vec2(t*0.01, -t*0.015), t);
				col *= mix(0.88, 1.12, paint);

				// Film dirt + textura leve
				float dirt = fbm(px*12.0 + vec2(t*0.03, -t*0.02));
				col += (dirt - 0.5) * 0.022 * (0.35 + 0.6*inten);

				// Partículas / marine snow
				float pn = fbm(px*vec2(220.0, 140.0) + vec2(0.0, t*0.35));
				float specks = smoothstep(0.86, 0.985, pn);
				float drift = fbm(px*vec2(12.0, 18.0) + vec2(0.0, t*0.10));
				specks *= (0.25 + 0.75*drift);
				col += specks * vec3(0.05, 0.10, 0.10) * (0.45 + 0.55*depth);

				// Burbujas leves
				float b = fbm(px*vec2(8.0, 14.0) + vec2(0.0, -t*0.25));
				float bubbles = smoothstep(0.80, 0.93, b) * smoothstep(0.0, 0.6, px.y);
				col += bubbles * vec3(0.05, 0.16, 0.16) * 0.25;

				// Viñeta + grain
				vec2 pp = px - 0.5;
				pp.x *= uRes.x / uRes.y;
				float vign = smoothstep(0.90, 0.22, dot(pp,pp));
				col *= (0.86 + 0.14*vign);

				float grain = hash(px*uRes.xy + fract(t)*1000.0);
				col += (grain - 0.5) * 0.028;

				// Grade + crush suave (evita negro puro)
				col = colorGrade(col);
				float shadowCrush = mix(0.0, 0.05, depth);
				col = max(col - shadowCrush, 0.0);

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
		const uDepthLoc = gl.getUniformLocation(prog, 'uDepth');
		const uIntensityLoc = gl.getUniformLocation(prog, 'uIntensity');

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

		// Para suavizar la velocidad en JS (evita jitter)
		let smVelX = 0;
		let smVelY = 0;
		let lastT = performance.now();

		const loop = () => {
			const now = performance.now();
			const t = (now - start) / 1000;

			const dt = Math.max(0.0001, (now - lastT) / 1000);
			lastT = now;

			gl.useProgram(prog);

			gl.uniform1f(uTimeLoc, t);
			gl.uniform2f(uResLoc, canvas.width, canvas.height);

			// Pos 0..1 (invertimos Y como en tu wormhole)
			const pos = playerPosRef.current;
			const px01 = window.innerWidth > 0 ? pos.x / window.innerWidth : 0.5;
			const py01 = window.innerHeight > 0 ? 1.0 - pos.y / window.innerHeight : 0.5;
			gl.uniform2f(uPlayerPosLoc, px01, py01);

			// Velocidad: tu playerVel probablemente está en px/s.
			// La convertimos a "pantallas por segundo" para que el shader sea estable.
			const vel = playerVelRef.current;
			const vx01 = window.innerWidth > 0 ? vel.x / window.innerWidth : 0.0;
			const vy01 = window.innerHeight > 0 ? -vel.y / window.innerHeight : 0.0; // signo para alinear con Y invertida

			// Suavizado (EMA)
			const k = 0.15;
			smVelX += (vx01 - smVelX) * k;
			smVelY += (vy01 - smVelY) * k;

			// Además podés escalar para controlar fuerza (0.5 suele estar bien)
			gl.uniform2f(uPlayerVelLoc, smVelX * 1.0, smVelY * 1.0);

			// Parámetros del underwater
			gl.uniform1f(uDepthLoc, depth);
			gl.uniform1f(uIntensityLoc, intensity);

			gl.clearColor(0.0, 0.0, 0.0, 0.0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			raf = requestAnimationFrame(loop);
		};

		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
			// (Opcional) cleanup extra: deleteProgram/shaders/buffers
		};
	}, [dprMax, depth, intensity]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 z-0"
			style={{ background: 'transparent' }}
		/>
	);
}
