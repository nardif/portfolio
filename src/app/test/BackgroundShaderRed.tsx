'use client';
import { useEffect, useRef } from 'react';

export default function BackgroundShaderRed() {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const gl = canvas.getContext('webgl');
		if (!gl) return;

		const vert = gl.createShader(gl.VERTEX_SHADER)!;
		gl.shaderSource(
			vert,
			`
      attribute vec2 aPos;
      void main() {
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `
		);
		gl.compileShader(vert);

		const frag = gl.createShader(gl.FRAGMENT_SHADER)!;
		gl.shaderSource(
			frag,
			`
      void main() {
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);  // rojo
      }
    `
		);
		gl.compileShader(frag);

		const prog = gl.createProgram()!;
		gl.attachShader(prog, vert);
		gl.attachShader(prog, frag);
		gl.linkProgram(prog);
		gl.useProgram(prog);

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

		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}, []);

	return (
		<canvas
			ref={canvasRef}
			width={typeof window !== 'undefined' ? window.innerWidth : 1920}
			height={typeof window !== 'undefined' ? window.innerHeight : 1080}
			className="fixed inset-0 z-50"
			style={{ background: 'transparent' }}
		/>
	);
}
