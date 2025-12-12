'use client';
import { useEffect, useRef } from 'react';

type Vec2 = { x: number; y: number };

type Props = {
	playerPos: Vec2;
	playerVel: Vec2;
	dprMax?: number;
};

export default function BackgroundShaderWormholeSimplified({
	playerPos,
	playerVel,
	dprMax = 2,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl');
		if (!gl) {
			console.warn('WebGL no disponible');
			return;
		}

		// Vertex shader
		const vertSrc = `
			attribute vec2 aPos;
			void main() {
				gl_Position = vec4(aPos, 0.0, 1.0);
			}
		`;

		// Fragment shader simplificado con playerPos y playerVel
		const fragSrc = `
			precision highp float;

			uniform vec2 uRes;
			uniform vec2 uPlayerPos;
			uniform vec2 uPlayerVelocity;

			void main() {
				vec2 uv = gl_FragCoord.xy / uRes;

				// visualizar playerPos como un color centrado
				float dx = distance(uv, uPlayerPos);
				float glow = smoothstep(0.1, 0.0, dx);

				// visualización de la dirección de velocidad
				vec2 dir = normalize(uPlayerVelocity + 0.0001);
				vec3 velCol = 0.5 + 0.5 * vec3(dir.x, dir.y, 1.0);

				vec3 color = mix(vec3(0.05, 0.1, 0.2), velCol, glow);
				gl_FragColor = vec4(color, 1.0);
			}
		`;

		// Helpers
		const createShader = (type: number, source: string) => {
			const shader = gl.createShader(type)!;
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				console.error('Shader compile error:', gl.getShaderInfoLog(shader));
			}
			return shader;
		};

		// Compile
		const vs = createShader(gl.VERTEX_SHADER, vertSrc);
		const fs = createShader(gl.FRAGMENT_SHADER, fragSrc);
		const prog = gl.createProgram()!;
		gl.attachShader(prog, vs);
		gl.attachShader(prog, fs);
		gl.linkProgram(prog);
		gl.useProgram(prog);

		// Buffers
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

		// Uniforms
		const uRes = gl.getUniformLocation(prog, 'uRes');
		const uPlayerPos = gl.getUniformLocation(prog, 'uPlayerPos');
		const uPlayerVel = gl.getUniformLocation(prog, 'uPlayerVelocity');

		// Resize
		const resize = () => {
			const dpr = Math.min(dprMax, window.devicePixelRatio || 1);
			const w = Math.floor(window.innerWidth);
			const h = Math.floor(window.innerHeight);
			canvas.width = w * dpr;
			canvas.height = h * dpr;
			canvas.style.width = `${w}px`;
			canvas.style.height = `${h}px`;
			gl.viewport(0, 0, canvas.width, canvas.height);
		};
		resize();
		window.addEventListener('resize', resize);

		let raf = 0;

		const loop = () => {
			gl.clearColor(0.0, 0.0, 0.0, 1.0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			gl.uniform2f(uRes, canvas.width, canvas.height);

			// playerPos debe estar en [0,1] relativo a la ventana, no al canvas escalado
			const px = window.innerWidth > 0 ? playerPos.x / window.innerWidth : 0.5;
			const py = window.innerHeight > 0 ? 1.0 - playerPos.y / window.innerHeight : 0.5;
			gl.uniform2f(uPlayerPos, px, py);
			gl.uniform2f(uPlayerVel, playerVel.x, playerVel.y);

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);
		};
	}, [playerPos.x, playerPos.y, playerVel.x, playerVel.y, dprMax]);

	return (
		<canvas ref={canvasRef} className="absolute inset-0 z-10" style={{ background: '#111' }} />
	);
}
