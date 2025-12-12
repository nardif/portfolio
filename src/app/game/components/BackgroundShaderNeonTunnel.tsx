'use client';
import { useEffect, useRef } from 'react';

export default function BackgroundShaderNeonStarsTunnel() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current!;
		const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
		if (!gl) {
			console.warn('WebGL no disponible');
			return;
		}

		const vertSrc = `
			attribute vec2 aPos;
			void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
		`;

		const fragSrc = `
			precision highp float;
			uniform float uTime;
			uniform vec2 uRes;

			// --- Noise / FBM ---
			float hash(vec2 p) {
				return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453);
			}
			float noise(vec2 p) {
				vec2 i = floor(p);
				vec2 f = fract(p);
				vec2 u = f*f*(3.0-2.0*f);
				return mix(
					mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
					mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
					u.y
				);
			}
			float fbm(vec2 p) {
				float v = 0.0;
				float a = 0.5;
				mat2 m = mat2(1.6,1.2,-1.2,1.6);
				for (int i = 0; i < 5; i++) {
					v += a * noise(p);
					p = m * p * 1.18;
					a *= 0.5;
				}
				return v;
			}

			// --- Paletas ---
			vec3 nebulaPalette(float t) {
				vec3 c1 = vec3(0.01, 0.02, 0.05);         // base más oscura
				vec3 c2 = vec3(0.04, 0.14, 0.28);         // tono principal más tenue
				vec3 blend = mix(c1, c2, smoothstep(0.2, 0.85, t));
				return blend + 0.04 * vec3(smoothstep(0.7, 1.0, t));  // menor realce
			}

			vec3 neonColor(float t) {
				if (t < 0.25) return mix(vec3(1.0,0.0,1.0), vec3(0.0,0.7,1.0), t*4.0);
				if (t < 0.5) return mix(vec3(0.0,0.7,1.0), vec3(1.0,1.0,0.0), (t-0.25)*4.0);
				if (t < 0.75) return mix(vec3(1.0,1.0,0.0), vec3(1.0,0.0,0.0), (t-0.5)*4.0);
				return mix(vec3(1.0,0.0,0.0), vec3(1.0,0.0,1.0), (t-0.75)*4.0);
			}

			// --- Estrellas tipo píxel con parpadeo ---
			float rand2(vec2 n){ return fract(sin(dot(n, vec2(12.9898,78.233))) * 43758.5453); }

			float starLayer(vec2 fragPx, float cell, float time) {
				vec2 p  = fragPx / cell;
				vec2 ip = floor(p);
				vec2 fp = fract(p);

				if (rand2(ip) < 0.82) return 0.0;

				vec2 sp = vec2(rand2(ip+11.1), rand2(ip+27.2));
				float sizePx = mix(0.8, 1.8, rand2(ip+91.7));
				float dPx = length((fp - sp) * cell);

				float core = smoothstep(sizePx, sizePx*0.5, dPx);

				// Parpadeo
				float tw = 0.5 + 0.5 * sin(time * (2.0 + 3.0 * rand2(ip+7.7)) + rand2(ip) * 6.2831);
				tw = pow(tw, 1.8);

				return core * tw;
			}

			void main() {
				vec2 uv0 = gl_FragCoord.xy / uRes;
				vec2 uv = uv0;
				float aspect = uRes.x / uRes.y;
				uv.x *= aspect;

				float t = uTime * 0.75;

				// --- Nebulosa ---
				vec2 q = uv * 2.0;
				q.y += sin(uv.x * 3.0 + t*0.7) * 0.12;
				q.x += cos(uv.y * 2.4 - t*0.9) * 0.10;

				vec2 r = q + 1.08 * vec2(
					fbm(q + vec2(0.0, t * 0.22)),
					fbm(q + vec2(t * 0.18, 1.0))
				);
				float n1 = fbm(r * 1.25 - vec2(0.0, t * 0.05));
				float n2 = fbm(r * 2.10 + vec2(t * 0.06, 0.0));
				float neb = mix(n1, n2, 0.35);
				neb = pow(clamp(neb, 0.0, 1.0), 0.85);
				vec3 nebCol = nebulaPalette(neb) * 0.6;
				vec3 col = nebCol;

				// --- Estrellas pequeñas parpadeantes ---
				mat2 rot = mat2(cos(0.15), -sin(0.15), sin(0.15), cos(0.15));
				vec2 center = 0.5 * uRes;
				vec2 fragPx = rot * (gl_FragCoord.xy - center) + center;

				float s = 0.0;
				s += starLayer(fragPx + vec2( 13.4,  -7.9),  6.0,  uTime * 1.00);
				s += 0.3 * starLayer(fragPx + vec2(-25.0,   5.0),  9.0,  uTime * 1.05);
				s += 0.2 * starLayer(fragPx + vec2( 40.0, -18.0), 12.0,  uTime * 0.95);

				col += vec3(1.0) * s * 0.95;

				// --- Líneas verticales neón ---
				for (float i = 0.0; i < 18.0; i += 1.0) {
					float x = fract(i / 18.0 + 0.03 * float(i) + 0.07 * sin(i*2.0 + t*0.5));
					float linePos = x * aspect;
					float dist = abs(uv.x - linePos);
					float width = 0.012 + 0.02 * pow(abs(sin(t*0.7+i)), 2.0);
					float alpha = exp(-dist*60.0) * (0.7 + 0.3 * sin(t+i*2.0));
					col += vec3(0.0,0.9,1.0) * alpha * 2.0;
				}

				// --- Overlay de color neón sutil ---
				// Mezcla con una versión menos saturada del color arcoíris
				vec3 neon = neonColor(fract(t * 0.1 + uv.y));

				// Convertir a gris (luminancia media)
				float gray = dot(neon, vec3(0.299, 0.587, 0.114));

				// Desaturar: mezcla entre gris y color original
				vec3 desaturated = mix(vec3(gray), neon, 0.6);  // 0.0 = gris, 1.0 = full color

				// Mezclar suavemente con el fondo
				col = mix(col, desaturated, 0.1);


				// --- Viñeta ---
				float vign = smoothstep(1.12, 0.58, length(uv0 - 0.5));
				col *= vign;

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
		gl.useProgram(prog);

		const aPos = gl.getAttribLocation(prog, 'aPos');
		const uTime = gl.getUniformLocation(prog, 'uTime');
		const uRes = gl.getUniformLocation(prog, 'uRes');

		const quad = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);
		gl.enableVertexAttribArray(aPos);
		gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

		let raf = 0;
		const start = performance.now();

		const resize = () => {
			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const w = window.innerWidth;
			const h = window.innerHeight;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			canvas.width = Math.floor(w * dpr);
			canvas.height = Math.floor(h * dpr);
			gl.viewport(0, 0, canvas.width, canvas.height);
		};
		resize();
		window.addEventListener('resize', resize);

		const loop = () => {
			const t = (performance.now() - start) / 1000;
			gl.uniform1f(uTime, t);
			gl.uniform2f(uRes, canvas.width, canvas.height);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	}, []);

	return (
		<canvas
			ref={canvasRef}
			className="fixed top-0 left-0 w-screen h-screen z-0"
			style={{ background: 'black' }}
		/>
	);
}
