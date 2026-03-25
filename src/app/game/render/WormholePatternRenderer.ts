// app/game/render/WormholePatternRenderer.ts
'use client';

type Pass = {
	program: WebGLProgram;
	aPos: number;
	uTime: WebGLUniformLocation | null;
	uRes: WebGLUniformLocation | null;
	uVel: WebGLUniformLocation | null; // ✅ queda solo para "tilt/respiración" interna
};

type RT = {
	width: number;
	height: number;
	tex: WebGLTexture;
	fbo: WebGLFramebuffer;
	rbo: WebGLRenderbuffer;
};

function compileShader(gl: WebGLRenderingContext, type: number, src: string) {
	const sh = gl.createShader(type)!;
	gl.shaderSource(sh, src);
	gl.compileShader(sh);
	if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
		console.error('Shader compile error:', gl.getShaderInfoLog(sh), '\n', src);
	}
	return sh;
}

function createProgram(gl: WebGLRenderingContext, vsSrc: string, fsSrc: string) {
	const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
	const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
	const prog = gl.createProgram()!;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
		console.error('Program link error:', gl.getProgramInfoLog(prog));
	}
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	return prog;
}

function isPOT(n: number) {
	return (n & (n - 1)) === 0;
}

function createRT(gl: WebGLRenderingContext, width: number, height: number): RT {
	const tex = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, tex);

	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	// ✅ estable + sin seams
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	const pot = isPOT(width) && isPOT(height);
	if (pot) {
		gl.generateMipmap(gl.TEXTURE_2D);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
	} else {
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	}

	const fbo = gl.createFramebuffer()!;
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

	const rbo = gl.createRenderbuffer()!;
	gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);

	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (status !== gl.FRAMEBUFFER_COMPLETE) console.error('FBO not complete:', status);

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	return { width, height, tex, fbo, rbo };
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// ✅ PATRÓN "FIJO": NO depende de spriteX.
// Importante: esto evita el desfase de las parábolas vs el centro del túnel final.
// Si querés "vida", la dejé por velocidad SOLO como rotación leve (no traslación).
const FRAG_PATTERN = `
precision highp float;

uniform float uTime;
uniform vec2  uRes;
uniform vec2  uVel;

varying vec2 vUv;

mat2 rot(float a){
  float c = cos(a), s = sin(a);
  return mat2(c,-s,s,c);
}

void main(){
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 p = (fragCoord - 0.5 * uRes) / uRes.y;

  float t = uTime;

  // ✅ Centro FIJO del patrón: q = p (sin restar tunnelCenter)
  vec2 q = p;

  // ✅ "tilt/respiración" interna por velocidad (sin mover el centro)
  vec2 vel = uVel;
  float velMag = clamp(length(vel) / 800.0, 0.0, 1.0);
  vec2 velDir = (length(vel) > 0.001) ? normalize(vel) : vec2(0.0, -1.0);
  q *= rot(velDir.x * 0.25 * velMag);

  // --- Hyperbolas ---
  float a = 0.25;
  float b = 0.18;
  float width = 0.008;

  float hyper = 0.0;

  float spriteSizeX = 0.04;
  float margin = 2.0 * spriteSizeX;
  float newMargin = margin * 0.4;
  float openAngle = 0.3;

  for(float i=-18.0;i<=18.0;i+=1.0){
    float offset = i * 0.055;
    float flash = 0.5 + 0.5*sin(t * 7.0 + i * 1.2 + q.y * 6.0);

    if (q.x < -newMargin && offset < 0.0){
      float d = abs(q.x - offset + a * openAngle * sqrt(1.0 + (q.y / b)*(q.y / b)));
      hyper += exp(-d / width) * flash;
    }
    if (q.x >  newMargin && offset > 0.0){
      float d = abs(q.x - offset - a * openAngle * sqrt(1.0 + (q.y / b)*(q.y / b)));
      hyper += exp(-d / width) * flash;
    }
  }
  hyper = clamp(hyper, 0.0, 1.0);

  // --- Warp lines ---
  float warpLines = 0.0;
  float rWarp = length(q);
  for (float k=-8.0;k<=8.0;k+=1.0){
    float ang = k * 0.13 + sin(t * 0.7 + k) * 0.05;
    float xCurve = rWarp * cos(ang);
    float yCurve = rWarp * sin(ang);
    float curve = abs(q.x - xCurve) + abs(q.y - yCurve);
    float speedAnim = 0.5 + 0.5 * sin(t * 2.5 + k * 1.5 + rWarp * 8.0);
    warpLines += exp(-curve / (0.012 + 0.008 * speedAnim)) * speedAnim;
  }
  warpLines = clamp(warpLines, 0.0, 1.0);

  // --- Grid + Ellipses ---
  float grid = 0.0;

  for (float j=-4.0;j<=4.0;j+=1.0){
    float xGrid = j * 0.13;
    float d = abs(q.x - xGrid);
    float flash = 0.5 + 0.5 * sin(t * 2.5 + j * 1.5 + q.y * 6.0);
    grid += exp(-d / width) * flash;
  }
  for (float m=-4.0;m<=4.0;m+=1.0){
    float yGrid = m * 0.13;
    float d = abs(q.y - yGrid);
    float flash = 0.5 + 0.5 * sin(t * 2.5 + m * 1.5 + q.x * 6.0);
    grid += exp(-d / width) * flash * 0.7;
  }

  float ellipseA = 0.7;
  float ellipseB = 0.25;
  for (float rr = 0.17; rr < 0.70; rr += 0.09) {
    for (float yShift=-0.56; yShift<=0.56; yShift += 0.18) {
      float d = abs((q.x*q.x)/(ellipseA*ellipseA) + ((q.y - yShift)*(q.y - yShift))/(ellipseB*ellipseB) - rr);
      float flash = 0.5 + 0.5 * sin(t * 7.0 + (q.y - yShift) * 6.0);
      grid += exp(-d / width) * flash * 0.55;
    }
  }
  grid = clamp(grid, 0.0, 1.0);

  float mask = clamp(hyper * 0.80 + grid * 0.55 + warpLines * 0.35, 0.0, 1.0);
  mask = pow(mask, 1.25);

  gl_FragColor = vec4(vec3(mask), 1.0);
}
`;

export class WormholePatternRenderer {
	private gl: WebGLRenderingContext;
	private quad: WebGLBuffer;

	private pass: Pass;
	public rt: RT;

	private frame = 0;
	private updateEveryN: number;

	constructor(gl: WebGLRenderingContext, rtWidth = 720, rtHeight = 432, updateEveryNFrames = 2) {
		this.gl = gl;
		this.updateEveryN = Math.max(1, updateEveryNFrames);

		this.quad = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);

		const prog = createProgram(gl, VERT, FRAG_PATTERN);
		this.pass = {
			program: prog,
			aPos: gl.getAttribLocation(prog, 'aPos'),
			uTime: gl.getUniformLocation(prog, 'uTime'),
			uRes: gl.getUniformLocation(prog, 'uRes'),
			uVel: gl.getUniformLocation(prog, 'uVel'),
		};

		this.rt = createRT(gl, rtWidth, rtHeight);
	}

	resizeRT(rtWidth: number, rtHeight: number) {
		rtWidth = Math.max(128, Math.floor(rtWidth));
		rtHeight = Math.max(128, Math.floor(rtHeight));
		if (rtWidth === this.rt.width && rtHeight === this.rt.height) return;

		const gl = this.gl;

		gl.deleteTexture(this.rt.tex);
		gl.deleteFramebuffer(this.rt.fbo);
		gl.deleteRenderbuffer(this.rt.rbo);

		this.rt = createRT(gl, rtWidth, rtHeight);
	}

	// ✅ API se mantiene igual para no tocar TS afuera.
	// spriteX01 ya NO se usa (lo dejamos por compatibilidad).
	render(time: number, _spriteX01: number, velPx: { x: number; y: number }) {
		const gl = this.gl;

		this.frame++;
		if (this.frame % this.updateEveryN !== 0) return;

		gl.bindFramebuffer(gl.FRAMEBUFFER, this.rt.fbo);
		gl.viewport(0, 0, this.rt.width, this.rt.height);
		gl.useProgram(this.pass.program);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.enableVertexAttribArray(this.pass.aPos);
		gl.vertexAttribPointer(this.pass.aPos, 2, gl.FLOAT, false, 0, 0);

		gl.uniform1f(this.pass.uTime, time);
		gl.uniform2f(this.pass.uRes, this.rt.width, this.rt.height);
		gl.uniform2f(this.pass.uVel, velPx.x, velPx.y);

		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// mipmaps si POT (mejor filtrado cuando se reescala)
		if (isPOT(this.rt.width) && isPOT(this.rt.height)) {
			gl.bindTexture(gl.TEXTURE_2D, this.rt.tex);
			gl.generateMipmap(gl.TEXTURE_2D);
			gl.bindTexture(gl.TEXTURE_2D, null);
		}

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	destroy() {
		const gl = this.gl;
		gl.deleteBuffer(this.quad);
		gl.deleteProgram(this.pass.program);

		gl.deleteTexture(this.rt.tex);
		gl.deleteFramebuffer(this.rt.fbo);
		gl.deleteRenderbuffer(this.rt.rbo);
	}
}
