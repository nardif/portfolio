// WebGL1 multipass: CausticsRT + RaysRT (masks) -> sampled by OceanFloor shader.

type Pass = {
	program: WebGLProgram;
	uTime: WebGLUniformLocation | null;
	uRes: WebGLUniformLocation | null;
};

export type RT = {
	size: number;
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

function createRT(gl: WebGLRenderingContext, size: number): RT {
	const tex = gl.createTexture()!;
	gl.bindTexture(gl.TEXTURE_2D, tex);

	// Masks in RGBA8 (WebGL1-safe)
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

	// IMPORTANT: avoid visible tiling seams on screen-space masks
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	const fbo = gl.createFramebuffer()!;
	gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

	const rbo = gl.createRenderbuffer()!;
	gl.bindRenderbuffer(gl.RENDERBUFFER, rbo);
	gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, size, size);
	gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, rbo);

	const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (status !== gl.FRAMEBUFFER_COMPLETE) {
		console.error('FBO not complete:', status);
	}

	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindTexture(gl.TEXTURE_2D, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);

	return { size, tex, fbo, rbo };
}

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// Painterly caustics mask (Crest-like multi-scale feel).
// Output mask in RGB (same value), alpha=1.
const FRAG_CAUSTICS = `
precision highp float;
uniform float uTime;
uniform vec2  uRes;
varying vec2 vUv;

// --- noise ---
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

// small voronoi-ish (cheap) caustics web
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
      o = 0.5 + 0.5*sin(uTime*0.55 + 6.2831*o);
      vec2 r = g + o - f;
      float d = dot(r,r);
      md = min(md, d);
    }
  }
  return md;
}

float causticMask(vec2 uv){
  // two scales mixed -> LOD-ish
  vec2 p1 = uv * vec2(10.0, 7.0) + vec2(0.0, -uTime*0.25);
  p1 += (fbm(uv*3.0 + uTime*0.10) - 0.5) * 0.35;

  vec2 p2 = uv * vec2(5.0, 3.5) + vec2(0.0, -uTime*0.12);
  p2 += (fbm(uv*1.7 + uTime*0.06) - 0.5) * 0.28;

  float v1 = voronoi(p1);
  float v2 = voronoi(p2);

  float c1 = 1.0 - smoothstep(0.010, 0.10, v1);
  float c2 = 1.0 - smoothstep(0.012, 0.12, v2);

  c1 = pow(c1, 3.2);
  c2 = pow(c2, 3.0);

  float mixLOD = smoothstep(0.25, 0.90, uv.y); // more detail near top
  float c = mix(c2, c1, mixLOD);

  c = smoothstep(0.10, 0.95, c);

  // painterly imperfection
  c *= 0.78 + 0.22*fbm(uv*18.0 + uTime*0.12);

  // shimmer
  float dance = 0.85 + 0.15*sin(uTime*1.15 + uv.x*6.0 + uv.y*3.0);
  c *= dance;

  return clamp(c, 0.0, 1.0);
}

void main(){
  vec2 uv = vUv;

  // domain warp to avoid “perfect overlay”
  float w = fbm(uv*2.0 + vec2(uTime*0.03, -uTime*0.02));
  uv += (w - 0.5) * 0.03;

  float c = causticMask(uv);
  gl_FragColor = vec4(vec3(c), 1.0);
}
`;

// Rays pass: diagonal “fan” from above, 1D bands to avoid blobs.
// Output mask in rgb.
const FRAG_RAYS = `
precision highp float;
uniform float uTime;
uniform vec2  uRes;
varying vec2 vUv;

float hash(float n){ return fract(sin(n)*43758.5453); }
float noise1(float x){
  float i = floor(x);
  float f = fract(x);
  float a = hash(i);
  float b = hash(i+1.0);
  float u = f*f*(3.0-2.0*f);
  return mix(a,b,u);
}
float fbm1(float x){
  float v = 0.0;
  float a = 0.55;
  for(int i=0;i<5;i++){
    v += a * noise1(x);
    x *= 2.02;
    a *= 0.5;
  }
  return v;
}

float hash2(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash2(i);
  float b = hash2(i+vec2(1.0,0.0));
  float c = hash2(i+vec2(0.0,1.0));
  float d = hash2(i+vec2(1.0,1.0));
  vec2 u = f*f*(3.0-2.0*f);
  return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
}
float fbm2(vec2 p){
  float v = 0.0;
  float a = 0.55;
  mat2 m = mat2(1.6,-1.2, 1.2,1.6);
  for(int i=0;i<4;i++){
    v += a * noise2(p);
    p = m*p;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 uv = vUv;

  // Origen arriba, leve inclinación (desde arriba hacia abajo)
  vec2 origin = vec2(0.52, 1.15);
  vec2 p = uv - origin;

  float down = clamp(1.0 - uv.y, 0.0, 1.0);
  float spread = mix(0.20, 1.25, down);
  p.x *= spread;

  // Tilt + warp para romper columnas perfectas
  float tilt = (uv.y - 0.5) * 0.55;         // depende de y
  float warp = fbm2(uv*2.2 + vec2(uTime*0.05, -uTime*0.03));
  p.x += tilt + (warp - 0.5) * 0.18;

  // Bandas 1D (principalmente x), pero “vivas”
  float x = p.x;

  float a = fbm1(x * 4.5 + uTime * 0.22);
  float b = fbm1(x * 12.0 + uTime * 0.38 + 10.0);
  float bands = mix(a, b, 0.58);

  // Contraste más suave (evita postes)
  bands = smoothstep(0.58, 0.93, bands);
  bands = pow(bands, 1.15);

  // Breakup 2D: hace que no sean columnas continuas
  float breakup = fbm2(vec2(x*2.0, uv.y*2.2) + vec2(uTime*0.06, -uTime*0.02));
  breakup = smoothstep(0.25, 0.95, breakup);
  bands *= mix(0.55, 1.05, breakup);

  // Shimmer suave
  float shimmer = 0.90 + 0.10*sin(uTime*1.25 + x*9.0 + uv.y*3.0);
  bands *= shimmer;

  // Nacen arriba, se disipan abajo
  float topMask = smoothstep(0.15, 0.98, uv.y);
  topMask *= topMask;

  float r = clamp(bands * topMask, 0.0, 1.0);
  gl_FragColor = vec4(vec3(r), 1.0);
}
`;

export class OceanLodRenderer {
	private gl: WebGLRenderingContext;

	private quad: WebGLBuffer;
	private aPosLocCaustics: number;
	private aPosLocRays: number;

	private caustics: Pass;
	private rays: Pass;

	public causticsRT: RT;
	public raysRT: RT;

	constructor(gl: WebGLRenderingContext, rtSize = 288) {
		this.gl = gl;

		// quad
		this.quad = gl.createBuffer()!;
		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.bufferData(
			gl.ARRAY_BUFFER,
			new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
			gl.STATIC_DRAW
		);

		// programs
		const causticsProg = createProgram(gl, VERT, FRAG_CAUSTICS);
		const raysProg = createProgram(gl, VERT, FRAG_RAYS);

		this.caustics = {
			program: causticsProg,
			uTime: gl.getUniformLocation(causticsProg, 'uTime'),
			uRes: gl.getUniformLocation(causticsProg, 'uRes'),
		};
		this.rays = {
			program: raysProg,
			uTime: gl.getUniformLocation(raysProg, 'uTime'),
			uRes: gl.getUniformLocation(raysProg, 'uRes'),
		};

		this.aPosLocCaustics = gl.getAttribLocation(causticsProg, 'aPos');
		this.aPosLocRays = gl.getAttribLocation(raysProg, 'aPos');

		// render targets
		this.causticsRT = createRT(gl, rtSize);
		this.raysRT = createRT(gl, rtSize);
	}

	render(time: number) {
		const gl = this.gl;

		// ---- Pass 1: caustics mask ----
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.causticsRT.fbo);
		gl.viewport(0, 0, this.causticsRT.size, this.causticsRT.size);
		gl.useProgram(this.caustics.program);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.enableVertexAttribArray(this.aPosLocCaustics);
		gl.vertexAttribPointer(this.aPosLocCaustics, 2, gl.FLOAT, false, 0, 0);

		gl.uniform1f(this.caustics.uTime, time);
		gl.uniform2f(this.caustics.uRes, this.causticsRT.size, this.causticsRT.size);

		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// ---- Pass 2: rays mask ----
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.raysRT.fbo);
		gl.viewport(0, 0, this.raysRT.size, this.raysRT.size);
		gl.useProgram(this.rays.program);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
		gl.enableVertexAttribArray(this.aPosLocRays);
		gl.vertexAttribPointer(this.aPosLocRays, 2, gl.FLOAT, false, 0, 0);

		gl.uniform1f(this.rays.uTime, time);
		gl.uniform2f(this.rays.uRes, this.raysRT.size, this.raysRT.size);

		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}

	destroy() {
		const gl = this.gl;

		gl.deleteBuffer(this.quad);

		gl.deleteProgram(this.caustics.program);
		gl.deleteProgram(this.rays.program);

		gl.deleteTexture(this.causticsRT.tex);
		gl.deleteFramebuffer(this.causticsRT.fbo);
		gl.deleteRenderbuffer(this.causticsRT.rbo);

		gl.deleteTexture(this.raysRT.tex);
		gl.deleteFramebuffer(this.raysRT.fbo);
		gl.deleteRenderbuffer(this.raysRT.rbo);
	}
}
