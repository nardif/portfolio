// app/game/components/BackgroundShaderWater.tsx
'use client';
import { useEffect, useRef } from 'react';

export default function BackgroundShaderWater() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current!;
		// WebGL2 -> WebGL1 fallback
		const gl =
			(canvas.getContext('webgl2') as WebGL2RenderingContext | null) ||
			(canvas.getContext('webgl') as WebGLRenderingContext | null);

		if (!gl) {
			console.warn('WebGL no disponible, usando 2D fallback');
			const ctx = canvas.getContext('2d');
			if (!ctx) return;

			const dpr = Math.min(2, window.devicePixelRatio || 1);
			const resize2d = () => {
				const w = window.innerWidth;
				const h = window.innerHeight;
				canvas.style.width = `${w}px`;
				canvas.style.height = `${h}px`;
				canvas.width = Math.floor(w * dpr);
				canvas.height = Math.floor(h * dpr);
			};
			resize2d();
			window.addEventListener('resize', resize2d);

			let raf = 0;
			const start = performance.now();
			const loop = () => {
				const t = (performance.now() - start) / 1000;
				const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
				g.addColorStop(0, `hsl(${(t * 40) % 360}, 70%, 15%)`);
				g.addColorStop(1, `hsl(${(t * 40 + 120) % 360}, 70%, 35%)`);
				ctx.fillStyle = g;
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				raf = requestAnimationFrame(loop);
			};
			raf = requestAnimationFrame(loop);
			return () => {
				cancelAnimationFrame(raf);
				window.removeEventListener('resize', resize2d);
			};
		}

		// WebGL: setup
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

		const vertSrc = `
      attribute vec2 aPos;
      void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
    `;
		const fragSrc = `
      precision highp float;
      uniform float uTime;
      uniform vec2 uRes;

      // efecto tipo waves/gradient
      void main() {
        vec2 uv = gl_FragCoord.xy / uRes.xy;
        uv.x *= uRes.x / uRes.y;

        float t = uTime * 0.25;
        float w = 0.5 + 0.5 * sin( (uv.y*5.5 + t) + 0.5*sin(uv.x*3.5 - t*1.2) );
        vec3 a = vec3(0.04, 0.06, 0.20);
        vec3 b = vec3(0.10, 0.35, 0.55);
        vec3 col = mix(a, b, w);
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
		<canvas ref={canvasRef} className="absolute inset-0 z-10" style={{ background: 'purple' }} />
	);
}
