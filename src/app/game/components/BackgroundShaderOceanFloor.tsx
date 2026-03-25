'use client';
import { useEffect, useRef } from 'react';
import { OceanLodRenderer } from '../render/OceanLodRenderer';

type Vec2 = { x: number; y: number };

type Props = {
	playerPos: Vec2;
	playerVel: Vec2;
	depth?: number;
	intensity?: number;
	anemoneOpen?: number;
	anemoneHover?: number;
	dprMax?: number;
};

export default function BackgroundShaderOceanFloor({
	playerPos,
	playerVel,
	depth = 0.8,
	intensity = 1.0,
	anemoneOpen = 0.0,
	anemoneHover = 0.0,
	dprMax = 2,
}: Props) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	const playerPosRef = useRef(playerPos);
	const playerVelRef = useRef(playerVel);
	const anemoneOpenRef = useRef(anemoneOpen);
	const anemoneHoverRef = useRef(anemoneHover);

	playerPosRef.current = playerPos;
	playerVelRef.current = playerVel;
	anemoneOpenRef.current = anemoneOpen;
	anemoneHoverRef.current = anemoneHover;

	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
		if (!gl) return;

		const vertSrc = `
			attribute vec2 aPos;
			varying vec2 vUv;
			void main() {
				vUv = aPos * 0.5 + 0.5;
				gl_Position = vec4(aPos, 0.0, 1.0);
			}
		`;

		const fragSrc = `
			precision highp float;

			uniform float uTime;
			uniform vec2  uRes;

			uniform vec2  uPlayerPos;
			uniform vec2  uPlayerVelocity;
			uniform float uDepth;
			uniform float uIntensity;

			uniform float uAnemoneOpen;
			uniform float uAnemoneHover;

			uniform sampler2D uCausticsTex;
			uniform sampler2D uRaysTex;

			varying vec2 vUv;

			// ---------- noise helpers (painterly + sand) ----------
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

			float painterly(vec2 uv, float t){
				vec2 p = uv;
				p.x *= 1.25;
				p.y *= 0.85;
				float n1 = fbm(p*6.0 + vec2(0.0, t*0.12));
				float n2 = fbm((p + vec2(n1*0.08, -n1*0.06))*14.0 + vec2(t*0.06, 0.0));
				float strokes = smoothstep(0.25, 0.85, n2);

				float paper = fbm(uv*40.0 + t*0.02);
				paper = smoothstep(0.15, 0.95, paper);

				return mix(strokes, strokes*paper, 0.45);
			}

			vec3 colorGrade(vec3 col){
				col = pow(col, vec3(0.96));
				col = vec3(col.r * 0.90, col.g * 1.02, col.b * 1.10);
				col = (col - 0.5) * 1.08 + 0.5;
				return clamp(col, 0.0, 1.0);
			}

			// ---------- Crest-like sampling ----------
			float sampleCaustics(vec2 uv, float t){
				float w = fbm(uv*2.0 + vec2(t*0.05, -t*0.03));
				vec2 duv = uv + (w - 0.5) * 0.02;

				vec2 uvNear = duv * vec2(1.25, 1.05) + vec2(0.0, -t*0.04);
				vec2 uvFar  = duv * vec2(0.70, 0.60) + vec2(0.0, -t*0.02);

				float cNear = texture2D(uCausticsTex, uvNear).r;
				float cFar  = texture2D(uCausticsTex, uvFar).r;

				float lodMix = smoothstep(0.25, 0.90, uv.y);
				float c = mix(cFar, cNear, lodMix);

				c = smoothstep(0.12, 0.95, c);
				return c;
			}

			float sampleRays(vec2 uv, float t){
				// drift vertical muy leve
				vec2 ruv = uv + vec2(0.0, -t*0.01);

				// blur horizontal/diagonal (5 taps)
				vec2 texel = vec2(1.0/320.0, 1.0/320.0); // si cambiás rtSize, actualizalo
				float r0 = texture2D(uRaysTex, ruv).r;
				float r1 = texture2D(uRaysTex, ruv + vec2( texel.x*1.5, texel.y*0.5)).r;
				float r2 = texture2D(uRaysTex, ruv + vec2(-texel.x*1.5, texel.y*0.5)).r;
				float r3 = texture2D(uRaysTex, ruv + vec2( texel.x*2.8, texel.y*1.1)).r;
				float r4 = texture2D(uRaysTex, ruv + vec2(-texel.x*2.8, texel.y*1.1)).r;

				float r = (r0*0.40 + r1*0.18 + r2*0.18 + r3*0.12 + r4*0.12);

				// shape suave (sin “postes”)
				r = smoothstep(0.10, 1.0, r);
				r = pow(r, 1.20);
				return clamp(r, 0.0, 1.0);
			}

			// ---------- sand ----------
			float sandRipples(vec2 uv, float t){
				float y = uv.y;
				float n = fbm(vec2(uv.x*6.0, uv.y*2.5) + vec2(t*0.02, -t*0.01));
				float rip = sin((uv.x*22.0 + n*2.0) + t*0.35);
				rip = rip*0.5 + 0.5;
				rip = smoothstep(0.55, 0.90, rip);
				float mask = smoothstep(0.55, 0.02, y);
				return rip * mask;
			}

			vec3 sandColor(vec2 uv, float t){
				vec3 sandA = vec3(0.16, 0.14, 0.10);
				vec3 sandB = vec3(0.24, 0.20, 0.14);

				float dunes = fbm(vec2(uv.x*2.0, uv.y*8.0) + vec2(0.0, -t*0.02));
				float grains = fbm(uv*80.0 + t*0.05);
				float rip = sandRipples(uv, t);

				vec3 c = mix(sandA, sandB, dunes);
				c += (grains - 0.5) * 0.06;
				c += rip * vec3(0.08, 0.06, 0.04);
				return c;
			}

			float sandHeight(vec2 uv, float t){
				float dunes = fbm(vec2(uv.x*1.8, uv.y*7.5) + vec2(0.0, -t*0.02));
				float ripN  = fbm(vec2(uv.x*6.0, uv.y*2.5) + vec2(t*0.02, -t*0.01));
				float rip   = sin((uv.x*22.0 + ripN*2.0) + t*0.35) * 0.5 + 0.5;
				rip = smoothstep(0.55, 0.90, rip);
				return dunes*0.6 + rip*0.9;
			}

			vec3 sandNormal(vec2 uv, float t){
				float e = 1.0 / uRes.y;
				float h0 = sandHeight(uv, t);
				float hx = sandHeight(uv + vec2(e, 0.0), t) - h0;
				float hy = sandHeight(uv + vec2(0.0, e), t) - h0;
				return normalize(vec3(-hx*3.0, -hy*3.0, 1.0));
			}

			// ---------- anemone ----------
			float sdCircle(vec2 p, float r){ return length(p) - r; }

			float tentacle(vec2 p, float ang, float len, float width, float wav, float tt){
				float c = cos(ang), s = sin(ang);
				vec2 q = vec2(c*p.x + s*p.y, -s*p.x + c*p.y);

				float y = clamp(q.y, 0.0, len);
				float curve = sin(y*wav + tt) * 0.06;
				float x = q.x - curve;

				float d = length(vec2(x, q.y - y)) - width;
				d = max(d, -q.y);
				d = max(d, q.y - len);
				return d;
			}

			vec3 anemoneColor(vec2 uv, float tt, float open){
				vec2 center = vec2(0.5, 0.42);
				vec2 p = uv - center;
				p.x *= uRes.x / uRes.y;

				float closed = 1.0 - open;

				float bulb = sdCircle(p + vec2(0.0, 0.03), 0.075);
				float bulbFill = smoothstep(0.02, -0.02, bulb);

				float slit = abs(p.x) + abs(p.y + 0.02)*0.35;
				float slitMask = smoothstep(0.05, 0.01, slit) * closed;

				float tent = 1.0;
				float petals = 14.0;
				float baseLen = mix(0.02, 0.18, open);
				float baseW  = mix(0.010, 0.008, open);

				for(int i=0;i<14;i++){
					float fi = float(i);
					float ang = (fi / petals) * 6.2831853;
					float len = baseLen * (0.85 + 0.25*sin(fi*1.7));
					float w = baseW * (0.9 + 0.2*sin(fi*2.3));
					float wav = 10.0 + 4.0*sin(fi);
					float dt = tt*1.2 + fi*0.6;
					float d = tentacle(p, ang, len, w, wav, dt);
					tent = min(tent, d);
				}

				float tentFill = smoothstep(0.015, -0.015, tent) * open;

				vec3 violetDeep = vec3(0.12, 0.02, 0.18);
				vec3 violetHi   = vec3(0.75, 0.25, 1.00);

				vec3 col = vec3(0.0);
				col += bulbFill * mix(violetDeep, violetHi, 0.35);
				col += slitMask * violetHi * 0.35;
				col += tentFill * mix(violetDeep, violetHi, 0.65);

				float halo = exp(-length(p) * 10.0) * (0.25 + 0.35*open);
				col += halo * violetHi * 0.35;

				return col;
			}

			void main(){
				vec2 uv = vUv;
				vec2 px = gl_FragCoord.xy / uRes.xy;

				float t = uTime;
				float depth = clamp(uDepth, 0.0, 1.0);
				float inten = max(uIntensity, 0.0);
				
				// refraction similar to your underwater
				vec2 vel = clamp(uPlayerVelocity, vec2(-2.0), vec2(2.0));
				float dpl = distance(uv, uPlayerPos);
				float influence = smoothstep(0.60, 0.06, dpl);

				vec2 flowDir = normalize(vec2(0.15, -1.0) + vel*1.0);
				float flowNoise = fbm(uv*4.0 + t*0.15);
				vec2 flow = flowDir * (0.006 + 0.014*flowNoise) * (0.20 + 0.80*influence);

				float wave = fbm(uv*2.0 + vec2(t*0.04, -t*0.03));
				vec2 refractUv = uv + flow + (wave - 0.5) * 0.014 * (0.55 + 0.45*inten);
				
				// base ocean floor water
				vec3 deepCol = vec3(0.010, 0.045, 0.055);
				vec3 midCol = vec3(0.028, 0.105, 0.115);
				vec3 shallowCol = vec3(0.060, 0.205, 0.210);
				
				float y = refractUv.y;
				vec3 base = mix(deepCol, midCol, smoothstep(0.0, 0.65, y));
				base = mix(base, shallowCol, smoothstep(0.65, 1.0, y) * 0.55);
				
				float fogStrength = mix(1.2, 2.3, depth);
				float fog = 1.0 - exp(-fogStrength * (1.0 - y));
				vec3 fogColor = vec3(0.04, 0.16, 0.16);
				base = mix(base, fogColor, fog * (0.22 + 0.16*inten));
				
				// masks from RTs
				float cst = sampleCaustics(refractUv, t);
				float r = sampleRays(refractUv, t);

				float volMask = smoothstep(0.18, 0.98, refractUv.y);
				float topBoost = smoothstep(0.55, 1.0, refractUv.y);
				
				vec3 cstTint = vec3(0.05, 0.18, 0.18);
				
				vec3 raysCol = vec3(0.05, 0.14, 0.14) * r * (0.60 + 0.20*inten);
				raysCol *= (0.55 + 0.45*volMask);
				
				float dance = 0.86 + 0.14*sin(t*1.35 + refractUv.x*6.0 + refractUv.y*2.0);
				float volCst = cst * volMask * (0.18 + 0.10*topBoost);
				vec3 cstVolCol = cstTint * volCst * (0.22 + 0.20*inten) * dance;

				vec3 col = base + raysCol + cstVolCol;

				float lift = mix(0.04, 0.09, refractUv.y);
				lift = mix(lift, 0.06, depth);
				col += vec3(0.02, 0.05, 0.05) * lift;
				
				// anemone glow/bloom
				float open = clamp(uAnemoneOpen, 0.0, 1.0);
				vec2 aCenter = vec2(0.5, 0.42);
				vec2 ap = uv - aCenter; ap.x *= uRes.x / uRes.y;
				float ar = length(ap);

				float pulse = 0.85 + 0.15*sin(t*3.0);
				float glowCore = exp(-ar * 10.0) * open;
				float glowWide = exp(-ar * 3.5) * open;

				vec3 violet = vec3(0.75, 0.25, 1.00);
				vec3 violetDeep = vec3(0.20, 0.05, 0.30);

				col += glowWide * violetDeep * 0.45 * pulse;
				col += glowCore * violet * 0.65 * pulse;

				float lum = dot(col, vec3(0.299, 0.587, 0.114));
				float bloom = smoothstep(0.25, 0.85, lum) * glowCore;
				col += bloom * violet * 0.55;
				
				// sand
				float sandMask = smoothstep(0.52, 0.10, refractUv.y);
				vec3 sand = sandColor(refractUv, t);
				float sandMix = sandMask * (1.05 + 0.25*inten);
				col = mix(col, sand, clamp(sandMix, 0.0, 1.0));

				vec3 n = sandNormal(refractUv, t);
				vec3 L = normalize(vec3(-0.12, 0.80, 1.0));
				float ndl = clamp(dot(n, L), 0.0, 1.0);

				float floorDance = cst * (0.70 + 0.30*(0.5 + 0.5*sin(t*1.05 + refractUv.x*4.0 + refractUv.y*6.0)));
				vec3 floorTint = vec3(0.07, 0.22, 0.22);
				
				col += sandMask * floorTint * floorDance * (0.16 + 0.34*ndl) * (0.75 + 0.35*inten);

				float spec = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 18.0);
				col += sandMask * vec3(0.08, 0.20, 0.18) * spec * (0.35 + 0.25*inten);
				
				col *= 1.0 - 0.10 * sandMask;
				
				col += sandMask * glowWide * vec3(0.35, 0.10, 0.45) * 0.35;
				
				vec3 an = anemoneColor(uv, t, open);
				col += an;
				
				float hover = clamp(uAnemoneHover, 0.0, 1.0) * (1.0 - open);
				float hp = (0.5 + 0.5*sin(t*3.0)) * hover;
				col += hp * vec3(0.28, 0.10, 0.38) * 0.18;

				float paint = painterly(refractUv + vec2(t*0.01, -t*0.012), t);
				col *= mix(0.90, 1.10, paint);
				
				float gr = hash(px*uRes + fract(t)*1000.0);
				col += (gr - 0.5) * 0.020;
				
				vec2 pp = px - 0.5;
				pp.x *= uRes.x / uRes.y;
				float vign = smoothstep(0.95, 0.25, dot(pp,pp));
				col *= (0.90 + 0.10*vign);
				
				col = colorGrade(col);
				float shadowCrush = mix(0.015, 0.045, depth);
				col = max(col - shadowCrush, 0.0);
				
				col += vec3(0.01, 0.015, 0.015) * 0.25;
				
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

		// quad
		const aPos = gl.getAttribLocation(prog, 'aPos');
		const quad = gl.createBuffer()!;
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
		const uAnemoneOpenLoc = gl.getUniformLocation(prog, 'uAnemoneOpen');
		const uAnemoneHoverLoc = gl.getUniformLocation(prog, 'uAnemoneHover');

		const uCausticsTexLoc = gl.getUniformLocation(prog, 'uCausticsTex');
		const uRaysTexLoc = gl.getUniformLocation(prog, 'uRaysTex');

		// multipass renderer
		const lod = new OceanLodRenderer(gl, 288);

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

		let smVelX = 0;
		let smVelY = 0;

		const loop = () => {
			const t = (performance.now() - start) / 1000;

			// RT passes
			lod.render(t);

			// final
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			gl.viewport(0, 0, canvas.width, canvas.height);

			gl.useProgram(prog);
			gl.uniform1f(uTimeLoc, t);
			gl.uniform2f(uResLoc, canvas.width, canvas.height);

			const pos = playerPosRef.current;
			const px01 = window.innerWidth > 0 ? pos.x / window.innerWidth : 0.5;
			const py01 = window.innerHeight > 0 ? 1.0 - pos.y / window.innerHeight : 0.5;
			gl.uniform2f(uPlayerPosLoc, px01, py01);

			const vel = playerVelRef.current;
			const vx01 = window.innerWidth > 0 ? vel.x / window.innerWidth : 0.0;
			const vy01 = window.innerHeight > 0 ? -vel.y / window.innerHeight : 0.0;

			const k = 0.15;
			smVelX += (vx01 - smVelX) * k;
			smVelY += (vy01 - smVelY) * k;
			gl.uniform2f(uPlayerVelLoc, smVelX * 0.9, smVelY * 0.9);

			gl.uniform1f(uDepthLoc, depth);
			gl.uniform1f(uIntensityLoc, intensity);
			gl.uniform1f(uAnemoneOpenLoc, anemoneOpenRef.current);
			gl.uniform1f(uAnemoneHoverLoc, anemoneHoverRef.current);

			// bind textures
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, lod.causticsRT.tex);
			gl.uniform1i(uCausticsTexLoc, 0);

			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, lod.raysRT.tex);
			gl.uniform1i(uRaysTexLoc, 1);

			gl.clearColor(0, 0, 0, 0);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.drawArrays(gl.TRIANGLES, 0, 6);

			raf = requestAnimationFrame(loop);
		};

		raf = requestAnimationFrame(loop);

		return () => {
			cancelAnimationFrame(raf);
			window.removeEventListener('resize', resize);

			lod.destroy();

			gl.deleteBuffer(quad);
			gl.deleteProgram(prog);
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
