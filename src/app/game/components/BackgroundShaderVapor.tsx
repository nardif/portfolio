'use client';
import { useEffect, useRef } from 'react';

type Props = {
	/** Intensidad de distorsión (0.0 – 2.0) */
	warp?: number;
	/** Velocidad global (0.2 – 2.0) */
	speed?: number;
	/** Contraste/curva del color (0.6 – 1.8) */
	contrast?: number;
};

export default function BackgroundShaderVapor({ warp = 1.05, speed = 0.8, contrast = 1.0 }: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current!;
		const gl =
			(canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
			(canvas.getContext('webgl') as WebGLRenderingContext | null);
		if (!gl) {
			console.warn('WebGL no disponible');
			return;
		}

		const dpr = Math.min(2, window.devicePixelRatio || 1);
		const resize = () => {
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

		const vert = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;

		// ---- Fragment con FBM + domain warping estilo “wavy gradient” ----
		const frag = `
      precision highp float;
			precision mediump int;

      uniform float uTime;
      uniform vec2  uRes;
      uniform float uWarp;
      uniform float uSpeed;
      uniform float uContrast;

      // Hash/Noise utils
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
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

      // FBM
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
        for (int i=0; i<5; i++) {
          v += a * noise(p);
          p = m * p * 1.15;
          a *= 0.55;
        }
        return v;
      }

      // Paleta
      vec3 palette(float t) {
        vec3 c1 = vec3(0.03, 0.06, 0.20);
        vec3 c2 = vec3(0.10, 0.35, 0.60);
        vec3 c3 = vec3(0.65, 0.85, 1.00);
        return mix(c1, c2, smoothstep(0.2, 0.8, t)) + 0.12 * vec3(smoothstep(0.7,1.0,t));
      }

      void main() {
        vec2 uv = gl_FragCoord.xy / uRes.xy;
        // corregir aspect ratio (ondas más uniformes)
        uv.x *= uRes.x / uRes.y;

        float t = uTime * uSpeed;

        // Domain warping
        vec2 q = uv * 2.0;
        q.y += sin(uv.x * 3.0 + t*0.7) * 0.15;
        q.x += cos(uv.y * 2.0 - t*0.9) * 0.10;

        vec2 r = q;
        r += uWarp * vec2(
          fbm(q + vec2(0.0, t*0.25)),
          fbm(q + vec2(t*0.2, 1.0))
        );

        // Componer capas de fbm para profundidad
        float n1 = fbm(r*1.2 - vec2(0.0, t*0.05));
        float n2 = fbm(r*2.0 + vec2(t*0.06, 0.0));
        float n  = mix(n1, n2, 0.35);

        // Curva de contraste suave
        n = pow(clamp(n, 0.0, 1.0), uContrast);

        vec3 col;
				col = palette(n);

        // Bloom suave en zonas altas
        float glow = smoothstep(0.8, 1.0, n);
        col += 0.15 * glow;

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

		const vs = createShader(gl.VERTEX_SHADER, vert);
		const fs = createShader(gl.FRAGMENT_SHADER, frag);
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
		const uWarp = gl.getUniformLocation(prog, 'uWarp');
		const uSpeed = gl.getUniformLocation(prog, 'uSpeed');
		const uContrast = gl.getUniformLocation(prog, 'uContrast');

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
		const loop = () => {
			const t = (performance.now() - start) / 1000;

			gl.uniform1f(uTime, t);
			gl.uniform2f(uRes, canvas.width, canvas.height);
			gl.uniform1f(uWarp, warp);
			gl.uniform1f(uSpeed, speed);
			gl.uniform1f(uContrast, contrast);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	}, [warp, speed, contrast]);

	return (
		<canvas
			ref={canvasRef}
			className="absolute inset-0 z-0"
			style={{ background: 'transparent' }}
		/>
	);
}
