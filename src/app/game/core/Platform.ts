// core/Platform.ts
import { GameObject } from './GameObject';
import { Player } from './Player';

type HighlightRect = { x: number; y: number; width: number; height: number };
interface IceShard {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
}

type PlatformState = 'normal' | 'cracking' | 'falling' | 'fractured' | 'inactive';
interface Fragment {
	x: number;
	y: number;
	w: number;
	h: number;
	vx: number;
	vy: number;
	rot: number;
	vrot: number;
	life: number;
	maxLife: number;
	points: { x: number; y: number }[];
	cracks?: { points: { x: number; y: number }[] }[]; // small internal hairline cracks
}

interface CrackLine {
	points: { x: number; y: number }[]; // local coords relative to platform top-left
	length: number; // cached poly length
	branches: { points: { x: number; y: number }[]; length: number }[];
	progress: number; // 0-1 how much of the primary line has grown
	speed: number; // growth speed factor
}

interface CrackSpark {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	maxLife: number;
	size: number;
}

export class Platform implements GameObject {
	public readonly id: string;
	private readonly spawnX: number;
	private readonly spawnY: number;
	constructor(
		public x: number,
		public y: number,
		public width: number,
		public height: number
	) {
		this.id = 'plat-' + Math.random().toString(36).slice(2, 9);
		this.spawnX = x;
		this.spawnY = y;
	}

	// Ice/glass effect highlight state
	private highlightTarget = 0; // 0 or 1 depending on collision presence this frame
	private highlightStrength = 0; // lerped value for smooth fade
	private highlightRect: HighlightRect | null = null; // current collision area

	// Landing / cracking logic
	private landCount = 0; // how many landings on this platform
	private state: PlatformState = 'normal';
	private crackTimer = 0;
	private crackDuration = 450; // ms until it starts falling
	private vy = 0; // falling velocity
	private gravity = 0.00065; // per ms
	private lastLandingTime = 0; // ms timestamp for debounce

	// Fragmentation data
	private fragments: Fragment[] = [];
	// Crack jitter seeds
	private crackJitter: {
		ax: number;
		ay: number;
		rotAmp: number;
		phaseX: number;
		phaseY: number;
		phaseR: number;
	} | null = null;
	private crackLines: CrackLine[] | null = null; // generated when entering cracking
	private crackSparks: CrackSpark[] = [];
	private fractureDust: {
		x: number;
		y: number;
		vx: number;
		vy: number;
		life: number;
		maxLife: number;
		size: number;
	}[] = [];
	// Pre-cracking (after 2nd landing) early warning visuals
	private preCrackTimer = 0;
	private preCrackDuration = 900; // ms for subtle growth before real cracking
	private prePhaseFrost: {
		x: number;
		y: number;
		vx: number;
		vy: number;
		life: number;
		maxLife: number;
		size: number;
	}[] = [];

	// Ice shards particles
	private shards: IceShard[] = [];

	updateHighlight(dt: number, player: Player) {
		if (this.state === 'inactive') return;
		// Compute intersection rectangle between player and this platform
		const ix = Math.max(this.x, player.x);
		const iy = Math.max(this.y, player.y);
		const ix2 = Math.min(this.x + this.width, player.x + player.width);
		const iy2 = Math.min(this.y + this.height, player.y + player.height);
		if (ix2 > ix && iy2 > iy) {
			this.highlightTarget = 1;
			this.highlightRect = { x: ix, y: iy, width: ix2 - ix, height: iy2 - iy };
		} else {
			this.highlightTarget = 0;
			// keep last rect while fading out
		}
		// Time-based smoothing (approach target). Factor adjusted by dt (~16ms baseline)
		const speed = 0.18 * (dt / 16); // faster response for visibility
		this.highlightStrength += (this.highlightTarget - this.highlightStrength) * Math.min(1, speed);
		// Clamp tiny values to zero to avoid lingering draw cost
		if (this.highlightStrength < 0.01 && this.highlightTarget === 0) {
			this.highlightStrength = 0;
			if (this.highlightTarget === 0) this.highlightRect = null; // drop rect once faded
		}
	}

	registerLanding() {
		if (this.state !== 'normal') return;
		const now = performance.now();
		// Debounce: ignore if within 120ms of last landing (prevents double-count from resolution jitter)
		if (now - this.lastLandingTime < 120) return;
		this.lastLandingTime = now;
		this.landCount++;
		this.spawnShards();
		// After 2 landings: begin pre-crack visual (hairlines, frost motes)
		if (this.landCount === 2) {
			if (!this.crackLines) this.generateCrackLines(); // generate early so they can grow subtly
			this.emitPrePhaseFrost();
		}
		// Third landing: transition to active cracking / falling countdown
		if (this.landCount >= 3) {
			this.state = 'cracking';
			this.crackTimer = 0;
			// initialize jitter seeds for varied animation (slightly higher amplitudes if came from pre-phase)
			this.crackJitter = {
				ax: 1 + Math.random() * 1.5,
				ay: 0.6 + Math.random() * 1.1,
				rotAmp: 0.005 + Math.random() * 0.01,
				phaseX: Math.random() * Math.PI * 2,
				phaseY: Math.random() * Math.PI * 2,
				phaseR: Math.random() * Math.PI * 2,
			};
			// Speed up remaining crack growth so it catches up if pre-phase incomplete
			if (this.crackLines) {
				for (const l of this.crackLines) l.speed *= 1.35;
			}
		}
	}

	private spawnShards() {
		const count = 10 + Math.floor(Math.random() * 5);
		for (let i = 0; i < count; i++) {
			const sx = this.x + Math.random() * this.width;
			const sy = this.y - 2 + Math.random() * 4;
			const angle = Math.random() * Math.PI - Math.PI / 2; // spread sideways
			const speed = 0.12 + Math.random() * 0.28; // px per ms
			this.shards.push({
				x: sx,
				y: sy,
				vx: Math.cos(angle) * speed,
				vy: -Math.abs(Math.sin(angle)) * speed * 0.6 - (0.05 + Math.random() * 0.05),
				life: 0,
				maxLife: 650 + Math.random() * 400,
				size: 2 + Math.random() * 3,
			});
		}
	}

	private updateShards(dt: number) {
		if (!this.shards.length) return;
		for (const s of this.shards) {
			s.life += dt;
			// gravity
			s.vy += 0.0006 * dt;
			s.x += s.vx * dt;
			s.y += s.vy * dt;
		}
		// remove dead
		this.shards = this.shards.filter((s) => s.life < s.maxLife);
	}

	isCollidable(): boolean {
		// Only normal & cracking should support collision; once falling/fractured it should not.
		return this.state === 'normal' || this.state === 'cracking';
	}

	private startFallingPhase() {
		// Convert platform into fragments and remove solid body
		if (this.state !== 'cracking') return;
		this.createFragments();
		// spawn fracture dust burst
		this.spawnFractureDust();
		this.state = 'fractured';
	}

	private createFragments() {
		this.fragments.length = 0;
		// Diverse set of fragment shapes for richer break: mix of triangular, jagged strip, multi-vertex shard
		const pieces = 6 + Math.floor(Math.random() * 4); // 6-9
		const xs: number[] = [0];
		for (let i = 1; i < pieces; i++) {
			const t = i / pieces;
			const base = t * this.width;
			xs.push(base + (Math.random() * 12 - 6));
		}
		xs.push(this.width);
		xs.sort((a, b) => a - b);

		const shapeTypeWeights = { triangle: 0.1, jagged: 0.3, multi: 0.3 };
		function pickType() {
			const r = Math.random();
			if (r < shapeTypeWeights.triangle) return 'triangle';
			if (r < shapeTypeWeights.triangle + shapeTypeWeights.jagged) return 'jagged';
			return 'multi';
		}

		for (let i = 0; i < pieces; i++) {
			const x0 = xs[i];
			const x1 = xs[i + 1];
			const w = Math.max(5, x1 - x0);
			const shape = pickType();
			const hVar = this.height * (0.8 + Math.random() * 0.55);
			const poly: { x: number; y: number }[] = [];
			if (shape === 'triangle') {
				// keep some pointy shards but toned down apex
				const apexExtra = hVar * (0.05 + Math.random() * 0.15);
				const sideIn = 0.18 + Math.random() * 0.22;
				poly.push({ x: 0, y: Math.random() * 3 });
				poly.push({ x: w * sideIn, y: hVar * 0.35 + Math.random() * hVar * 0.08 });
				poly.push({ x: w - w * sideIn, y: hVar * 0.38 + Math.random() * hVar * 0.1 });
				poly.push({ x: w, y: Math.random() * 3 });
				poly.push({ x: w * 0.5 + (Math.random() * 0.3 - 0.15) * w, y: hVar + apexExtra });
			} else if (shape === 'jagged') {
				// A vertical strip with irregular edges
				const topSegs = 2 + Math.floor(Math.random() * 3); // 2-4
				for (let t = 0; t <= topSegs; t++) {
					const tt = t / topSegs;
					const jitter = (Math.random() * 5 - 2.5) * (1 - 0.5 * Math.abs(tt - 0.5));
					poly.push({ x: tt * w, y: jitter });
				}
				const bottomSegs = 2 + Math.floor(Math.random() * 3);
				for (let t = 0; t <= bottomSegs; t++) {
					const tt = t / bottomSegs;
					const jitter = Math.random() * 6 - 3;
					poly.push({ x: w - tt * w, y: hVar + jitter });
				}
				// inward side nicks
				if (Math.random() < 0.5)
					poly.splice(1, 0, { x: w * 0.08, y: hVar * 0.22 + Math.random() * hVar * 0.1 });
				if (Math.random() < 0.5)
					poly.splice(poly.length - 1, 0, {
						x: w * 0.92,
						y: hVar * 0.28 + Math.random() * hVar * 0.1,
					});
			} else {
				// multi
				// Multi-vertex shard with slight concavity and maybe a small lower spur
				const topCount = 3 + Math.floor(Math.random() * 3); // 3-5
				for (let t = 0; t < topCount; t++) {
					const tt = t / (topCount - 1);
					const j = (Math.random() * 4 - 2) * (1 - 0.5 * Math.abs(tt - 0.5));
					poly.push({ x: tt * w, y: j });
				}
				// side bulges
				if (Math.random() < 0.7)
					poly.push({
						x: w * (0.15 + Math.random() * 0.15),
						y: hVar * 0.35 + Math.random() * hVar * 0.1,
					});
				if (Math.random() < 0.7)
					poly.push({
						x: w * (0.85 - Math.random() * 0.15),
						y: hVar * 0.4 + Math.random() * hVar * 0.1,
					});
				// lower ridge with 2-3 points
				const lowerPts = 2 + Math.floor(Math.random() * 2);
				for (let k = 0; k <= lowerPts; k++) {
					const kk = k / lowerPts;
					const j = Math.random() * 5 - 2.5;
					poly.push({ x: w - kk * w, y: hVar * 0.75 + j });
				}
				// bottom cluster / mild apex (not as sharp)
				poly.push({
					x: w * 0.5 + (Math.random() * 0.4 - 0.2) * w,
					y: hVar + hVar * (0.05 + Math.random() * 0.12),
				});
				// optional spur
				if (Math.random() < 0.4)
					poly.push({
						x: w * 0.3 + (Math.random() * 0.2 - 0.1) * w,
						y: hVar * 0.55 + Math.random() * hVar * 0.1,
					});
			}
			// Normalize vertical extent and maybe rotate slightly (skip rotation for perf now)
			// Slim factor influences physics
			const slimFactor = Math.max(0.3, Math.min(1, w / (this.width / pieces)));
			const baseVy = -0.2 - Math.random() * 0.22;
			const extraH = poly.reduce((mx, p) => Math.max(mx, p.y), 0);
			const frag: Fragment = {
				x: this.x + x0,
				y: this.y + (this.height - hVar),
				w,
				h: Math.max(hVar, extraH),
				vx: (-0.085 + Math.random() * 0.17) * (1 + (1 - slimFactor) * 0.5),
				vy: baseVy * (0.9 + Math.random() * 0.35),
				rot: 0,
				vrot: (-0.0035 + Math.random() * 0.007) * (1 + (1 - slimFactor) * 1.1),
				life: 0,
				maxLife: 2200 + Math.random() * 1800,
				points: poly,
				cracks: this.generateFragmentCracks(w, hVar * 0.85),
			};
			this.fragments.push(frag);
		}
	}

	private generateFragmentCracks(w: number, h: number) {
		const count = Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 3) : 0; // 0-3 small cracks
		const arr: { points: { x: number; y: number }[] }[] = [];
		for (let i = 0; i < count; i++) {
			const pts: { x: number; y: number }[] = [];
			const segs = 2 + Math.floor(Math.random() * 3);
			let x = w * (0.2 + Math.random() * 0.6);
			let y = h * (0.2 + Math.random() * 0.6);
			pts.push({ x, y });
			let ang = Math.random() * Math.PI * 2;
			for (let s = 0; s < segs; s++) {
				const len = 6 + Math.random() * 12;
				ang += Math.random() * 0.6 - 0.3;
				x += Math.cos(ang) * len;
				y += Math.sin(ang) * len;
				pts.push({ x: Math.max(2, Math.min(w - 2, x)), y: Math.max(2, Math.min(h - 2, y)) });
			}
			arr.push({ points: pts });
		}
		return arr;
	}

	private spawnFractureDust() {
		const base = 14 + Math.floor(Math.random() * 12);
		for (let i = 0; i < base; i++) {
			const ang = Math.random() * Math.PI * 2;
			const spd = 0.07 + Math.random() * 0.18;
			this.fractureDust.push({
				x: this.x + this.width / 2,
				y: this.y + this.height / 2,
				vx: Math.cos(ang) * spd,
				vy: Math.sin(ang) * spd - 0.05,
				life: 0,
				maxLife: 600 + Math.random() * 500,
				size: 1 + Math.random() * 2.2,
			});
		}
	}

	private emitPrePhaseFrost() {
		// gentle outward motes from center
		const count = 8 + Math.floor(Math.random() * 6);
		for (let i = 0; i < count; i++) {
			const ang = Math.random() * Math.PI * 2;
			const spd = 0.02 + Math.random() * 0.05;
			this.prePhaseFrost.push({
				x: this.x + this.width / 2,
				y: this.y + this.height / 2,
				vx: Math.cos(ang) * spd,
				vy: Math.sin(ang) * spd - 0.015,
				life: 0,
				maxLife: 700 + Math.random() * 500,
				size: 1 + Math.random() * 1.3,
			});
		}
	}

	private generateCrackLines() {
		const lines: CrackLine[] = [];
		const primaryCount = 3 + Math.floor(Math.random() * 3); // 3-5 primaries
		const impactX = this.width * (0.3 + Math.random() * 0.4);
		for (let i = 0; i < primaryCount; i++) {
			const pts: { x: number; y: number }[] = [];
			const lenSegments = 4 + Math.floor(Math.random() * 3); // 4-6 segments
			let x = impactX + (Math.random() * 30 - 15);
			let y = this.height / 2 + (Math.random() * 10 - 5);
			pts.push({ x, y });
			let baseAngle = -Math.PI / 2 + Math.random() * Math.PI * 0.6; // upward-ish
			for (let s = 0; s < lenSegments; s++) {
				const segLen = 8 + Math.random() * (18 + s * 4);
				const jitterAngle = baseAngle + (Math.random() * 0.6 - 0.3);
				x += Math.cos(jitterAngle) * segLen;
				y += Math.sin(jitterAngle) * segLen;
				pts.push({ x, y });
				baseAngle += (Math.random() * 0.4 - 0.2) * 0.5; // drift
			}
			// clip horizontally
			pts.forEach((p) => {
				p.x = Math.max(0, Math.min(this.width, p.x));
				p.y = Math.max(0, Math.min(this.height, p.y));
			});
			// compute length
			let length = 0;
			for (let j = 1; j < pts.length; j++) {
				const dx = pts[j].x - pts[j - 1].x;
				const dy = pts[j].y - pts[j - 1].y;
				length += Math.hypot(dx, dy);
			}
			// branches
			const branches: { points: { x: number; y: number }[]; length: number }[] = [];
			if (Math.random() < 0.9) {
				// add 0-2 branches
				const bCount = Math.random() < 0.5 ? 1 : 2;
				for (let b = 0; b < bCount; b++) {
					const originIndex = 1 + Math.floor(Math.random() * (pts.length - 2));
					const origin = pts[originIndex];
					const branchPts = [origin];
					let bx = origin.x;
					let by = origin.y;
					const branchSegs = 2 + Math.floor(Math.random() * 3);
					let ang = (Math.random() < 0.5 ? 1 : -1) * (0.6 + Math.random() * 0.5);
					for (let k = 0; k < branchSegs; k++) {
						const bl = 6 + Math.random() * 12;
						bx += Math.cos(ang) * bl;
						by += Math.sin(ang) * bl;
						branchPts.push({
							x: Math.max(0, Math.min(this.width, bx)),
							y: Math.max(0, Math.min(this.height, by)),
						});
						ang += Math.random() * 0.5 - 0.25;
					}
					let blen = 0;
					for (let m = 1; m < branchPts.length; m++) {
						const dx = branchPts[m].x - branchPts[m - 1].x;
						const dy = branchPts[m].y - branchPts[m - 1].y;
						blen += Math.hypot(dx, dy);
					}
					branches.push({ points: branchPts.slice(), length: blen });
				}
			}
			lines.push({
				points: pts,
				length,
				branches,
				progress: 0,
				speed: 0.25 + Math.random() * 0.55,
			});
		}
		this.crackLines = lines;
	}

	update(dt: number) {
		if (this.state === 'cracking') {
			this.crackTimer += dt;
			this.updateCracks(dt);
			if (this.crackTimer >= this.crackDuration) {
				this.startFallingPhase();
			}
		} else if (this.state === 'fractured') {
			// update fragment physics
			for (const f of this.fragments) {
				f.life += dt;
				f.vy += this.gravity * dt * 1.2; // slightly stronger gravity on fragments
				f.x += f.vx * dt * 1.0;
				f.y += f.vy * dt * 0.9; // some drag
				f.rot += f.vrot * dt;
			}
			// update dust
			if (this.fractureDust.length) {
				for (const d of this.fractureDust) {
					d.life += dt;
					d.x += d.vx * dt;
					d.y += d.vy * dt;
					d.vy += 0.00025 * dt;
				}
				this.fractureDust = this.fractureDust.filter((d) => d.life < d.maxLife);
			}
			// remove old fragments (allow them to fade out in draw later?)
			if (!this.fragments.some((f) => f.life < f.maxLife)) {
				this.state = 'inactive';
			}
		}
		// Pre-crack phase (after 2nd landing, still normal)
		if (this.state === 'normal' && this.landCount >= 2) {
			this.preCrackTimer += dt;
			// gentle slow growth of existing crack lines
			if (this.crackLines) {
				for (const l of this.crackLines) {
					if (l.progress < 0.65) {
						// cap before full until cracking state
						l.progress += l.speed * (dt / 1000) * 0.25; // slower
						if (l.progress > 0.65) l.progress = 0.65;
					}
				}
			}
			// update frost motes
			if (this.prePhaseFrost.length) {
				for (const f of this.prePhaseFrost) {
					f.life += dt;
					f.x += f.vx * dt;
					f.y += f.vy * dt;
					f.vy += 0.0002 * dt;
				}
				this.prePhaseFrost = this.prePhaseFrost.filter((p) => p.life < p.maxLife);
			}
		}
		this.updateShards(dt);
	}

	private drawRoundedRect(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		w: number,
		h: number,
		r: number
	) {
		const rr = Math.min(r, h / 2, w / 2);
		ctx.beginPath();
		ctx.moveTo(x + rr, y);
		ctx.lineTo(x + w - rr, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
		ctx.lineTo(x + w, y + h - rr);
		ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
		ctx.lineTo(x + rr, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
		ctx.lineTo(x, y + rr);
		ctx.quadraticCurveTo(x, y, x + rr, y);
		ctx.closePath();
	}

	private drawCracks(ctx: CanvasRenderingContext2D, radius: number) {
		if (this.landCount < 2 && this.state === 'normal') return;
		let progress: number;
		if (this.state === 'cracking') progress = Math.min(1, this.crackTimer / this.crackDuration);
		else if (this.state === 'normal' && this.landCount >= 2) {
			const preP = Math.min(1, this.preCrackTimer / this.preCrackDuration);
			progress = 0.3 + preP * 0.5; // never reaches 1 in pre-phase
		} else progress = 1;
		if (this.crackLines) {
			ctx.save();
			ctx.beginPath();
			this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
			ctx.clip();
			// stress glow
			if (this.state === 'cracking' || (this.state === 'normal' && this.landCount >= 2)) {
				const gx = this.x + this.width / 2;
				const gy = this.y + this.height / 2;
				const rg = ctx.createRadialGradient(
					gx,
					gy,
					4,
					gx,
					gy,
					Math.max(this.width, this.height) * 0.9
				);
				const glowScale = this.state === 'cracking' ? 1 : 0.45; // weaker in pre-phase
				rg.addColorStop(0, `rgba(210,245,255,${0.22 * progress * glowScale})`);
				rg.addColorStop(0.4, `rgba(170,220,255,${0.12 * progress * glowScale})`);
				rg.addColorStop(1, 'rgba(170,220,255,0)');
				ctx.globalAlpha = 0.9;
				ctx.fillStyle = rg;
				ctx.fillRect(this.x - 12, this.y - 12, this.width + 24, this.height + 24);
			}
			for (const line of this.crackLines) {
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				const drawPartial = (pts: { x: number; y: number }[], totalLen: number, frac: number) => {
					const target = totalLen * frac;
					ctx.beginPath();
					let acc = 0;
					for (let i = 0; i < pts.length; i++) {
						const px = this.x + pts[i].x;
						const py = this.y + pts[i].y;
						if (i === 0) {
							ctx.moveTo(px, py);
							continue;
						}
						const dx = pts[i].x - pts[i - 1].x;
						const dy = pts[i].y - pts[i - 1].y;
						const segL = Math.hypot(dx, dy);
						if (acc + segL > target) {
							const remain = target - acc;
							const r = remain / segL;
							ctx.lineTo(this.x + pts[i - 1].x + dx * r, this.y + pts[i - 1].y + dy * r);
							break;
						} else {
							ctx.lineTo(px, py);
							acc += segL;
						}
					}
				};
				const lf = (line.progress * 0.85 + 0.15) * progress;
				const phaseScale = this.state === 'cracking' ? 1 : 0.55; // dimmer lines in pre-phase
				ctx.strokeStyle = `rgba(210,235,255,${(0.18 + 0.42 * lf) * phaseScale})`;
				ctx.lineWidth = this.state === 'cracking' ? 2.4 : 1.8;
				drawPartial(line.points, line.length, lf);
				ctx.stroke();
				ctx.strokeStyle = `rgba(235,250,255,${(0.35 + 0.55 * lf) * phaseScale})`;
				ctx.lineWidth = this.state === 'cracking' ? 1.1 : 0.9;
				drawPartial(line.points, line.length, lf);
				ctx.stroke();
				for (const b of line.branches) {
					let bf = Math.min(1, progress * 1.3 - 0.25);
					if (this.state === 'normal') bf *= 0.5; // branches even subtler in pre-phase
					if (bf <= 0) continue;
					ctx.strokeStyle = `rgba(230,245,255,${(0.25 + 0.45 * bf) * phaseScale})`;
					ctx.lineWidth = this.state === 'cracking' ? 0.9 : 0.6;
					drawPartial(b.points, b.length, bf);
					ctx.stroke();
				}
			}
			if (this.state === 'cracking' && this.crackSparks && this.crackSparks.length) {
				for (const s of this.crackSparks) {
					const p = s.life / s.maxLife;
					ctx.globalAlpha = (1 - p) * 0.9;
					ctx.fillStyle = 'rgba(240,255,255,1)';
					ctx.beginPath();
					ctx.arc(this.x + s.x, this.y + s.y, s.size * (0.6 + 0.4 * (1 - p)), 0, Math.PI * 2);
					ctx.fill();
				}
			}
			ctx.restore();
			return;
		}

		// fallback old system
		ctx.save();
		ctx.clip();
		ctx.strokeStyle = `rgba(220,240,255,${0.35 + 0.4 * progress})`;
		ctx.lineWidth = 1.1;
		const cx = this.x + this.width / 2;
		const cy = this.y + this.height / 2;
		function crackTo(angle: number, len: number) {
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(cx + Math.cos(angle) * len, cy + Math.sin(angle) * len);
			ctx.stroke();
		}
		const cracks = 4 + Math.floor(progress * 4);
		for (let i = 0; i < cracks; i++) {
			const a = (i / cracks) * Math.PI * 2 + (progress < 1 ? Math.random() * 0.2 : 0);
			crackTo(a, this.width * 0.35 + progress * this.width * 0.25);
		}
		ctx.restore();
	}

	private getPolylinePointAt(points: { x: number; y: number }[], target: number) {
		let acc = 0;
		for (let i = 1; i < points.length; i++) {
			const p0 = points[i - 1];
			const p1 = points[i];
			const dx = p1.x - p0.x;
			const dy = p1.y - p0.y;
			const seg = Math.hypot(dx, dy);
			if (acc + seg >= target) {
				const r = (target - acc) / seg;
				return { x: p0.x + dx * r, y: p0.y + dy * r };
			}
			acc += seg;
		}
		return points[points.length - 1];
	}

	private updateCracks(dt: number) {
		if (!this.crackLines) return;
		const globalP = Math.min(1, this.crackTimer / this.crackDuration);
		for (const line of this.crackLines) {
			if (line.progress < 1) {
				line.progress += line.speed * (dt / 1000) * (0.6 + globalP * 1.4);
				if (line.progress > 1) line.progress = 1;
				// spawn spark at growth tip occasionally
				if (Math.random() < 0.25) {
					const tipLen = line.length * line.progress;
					const tip = this.getPolylinePointAt(line.points, tipLen);
					const ang = -0.4 + Math.random() * 0.8 + Math.PI / 2;
					this.crackSparks.push({
						x: tip.x,
						y: tip.y,
						vx: Math.cos(ang) * 0.04,
						vy: Math.sin(ang) * 0.04,
						life: 0,
						maxLife: 220 + Math.random() * 160,
						size: 1 + Math.random() * 1.2,
					});
				}
			}
		}
		// update sparks
		if (this.crackSparks.length) {
			for (const s of this.crackSparks) {
				s.life += dt;
				s.x += s.vx * dt;
				s.y += s.vy * dt;
				s.vy += 0.00015 * dt;
			}
			this.crackSparks = this.crackSparks.filter((s) => s.life < s.maxLife);
		}
	}

	draw(ctx: CanvasRenderingContext2D) {
		if (this.state === 'inactive') return;
		ctx.save();
		const radius = Math.min(12, this.height / 2);

		if (this.state === 'normal' || this.state === 'cracking') {
			// subtle edge frost pulse in pre-phase
			if (this.state === 'normal' && this.landCount >= 2) {
				const pulse = 0.4 + Math.sin(performance.now() * 0.004) * 0.3;
				ctx.save();
				this.drawRoundedRect(
					ctx,
					this.x - 2,
					this.y - 2,
					this.width + 4,
					this.height + 4,
					radius + 4
				);
				ctx.strokeStyle = `rgba(210,235,255,${0.15 + 0.2 * pulse})`;
				ctx.lineWidth = 2.2;
				ctx.stroke();
				ctx.restore();
			}
			if (this.state === 'cracking') {
				const p = Math.min(1, this.crackTimer / this.crackDuration);
				if (this.crackJitter) {
					const t = performance.now();
					const jx =
						Math.sin(t * 0.01 + this.crackJitter.phaseX) * this.crackJitter.ax * (0.3 + 0.7 * p);
					const jy =
						Math.sin(t * 0.013 + this.crackJitter.phaseY) * this.crackJitter.ay * (0.2 + 0.8 * p);
					const r =
						Math.sin(t * 0.009 + this.crackJitter.phaseR) *
						this.crackJitter.rotAmp *
						(0.4 + 0.6 * p);
					ctx.translate(jx, jy);
					ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
					ctx.rotate(r);
					ctx.translate(-(this.x + this.width / 2), -(this.y + this.height / 2));
				}
			}
			// Base body
			this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
			const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
			grad.addColorStop(0, 'rgba(255,255,255,0.42)');
			grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
			grad.addColorStop(1, 'rgba(215,240,255,0.40)');
			ctx.fillStyle = grad;
			ctx.fill();
			ctx.save();
			ctx.clip();
			const innerGrad = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
			innerGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
			innerGrad.addColorStop(0.55, 'rgba(255,255,255,0.08)');
			innerGrad.addColorStop(1, 'rgba(255,255,255,0.25)');
			ctx.globalAlpha = 0.75;
			ctx.fillStyle = innerGrad;
			ctx.fillRect(this.x, this.y, this.width, this.height);
			ctx.restore();
			ctx.lineWidth = 1.4;
			ctx.strokeStyle = 'rgba(255,255,255,0.6)';
			ctx.stroke();
			this.drawCracks(ctx, radius);

			if (this.highlightStrength > 0 && this.highlightRect) {
				const hr = this.highlightRect;
				ctx.save();
				ctx.beginPath();
				this.drawRoundedRect(ctx, this.x, this.y, this.width, this.height, radius);
				ctx.clip();
				ctx.globalAlpha = 0.35 + 0.65 * this.highlightStrength;
				const glow = ctx.createLinearGradient(hr.x, hr.y, hr.x, hr.y + hr.height);
				glow.addColorStop(0, 'rgba(200,255,255,0.95)');
				glow.addColorStop(0.5, 'rgba(160,230,255,0.75)');
				glow.addColorStop(1, 'rgba(140,210,255,0.90)');
				ctx.fillStyle = glow;
				ctx.fillRect(hr.x - 3, hr.y - 3, hr.width + 6, hr.height + 6);
				const feather = Math.min(55, hr.width * 0.9);
				const fadeGrad = ctx.createLinearGradient(hr.x - feather, 0, hr.x + hr.width + feather, 0);
				fadeGrad.addColorStop(0, 'rgba(170,220,255,0)');
				fadeGrad.addColorStop(0.35, 'rgba(190,240,255,0.55)');
				fadeGrad.addColorStop(0.65, 'rgba(190,240,255,0.55)');
				fadeGrad.addColorStop(1, 'rgba(170,220,255,0)');
				ctx.globalAlpha = this.highlightStrength * 0.8;
				ctx.fillStyle = fadeGrad;
				ctx.fillRect(hr.x - feather, this.y, hr.width + feather * 2, this.height);
				ctx.restore();
			}
		}

		if (this.state === 'fractured') {
			for (const f of this.fragments) {
				const lifeP = Math.min(1, f.life / f.maxLife);
				const fade = 1 - lifeP * 0.9;
				ctx.save();
				ctx.translate(f.x + f.w / 2, f.y + f.h / 2);
				ctx.rotate(f.rot);
				ctx.translate(-f.w / 2, -f.h / 2);
				ctx.globalAlpha = fade;
				// Build path from polygon points
				ctx.beginPath();
				for (let i = 0; i < f.points.length; i++) {
					const pt = f.points[i];
					if (i === 0) ctx.moveTo(pt.x - f.w / 2 + f.w / 2, pt.y - f.h + f.h);
					else ctx.lineTo(pt.x - f.w / 2 + f.w / 2, pt.y - f.h + f.h);
				}
				ctx.closePath();
				const fg = ctx.createLinearGradient(0, 0, 0, f.h);
				fg.addColorStop(0, 'rgba(255,255,255,0.68)');
				fg.addColorStop(0.55, 'rgba(200,230,250,0.28)');
				fg.addColorStop(1, 'rgba(160,205,235,0.18)');
				ctx.fillStyle = fg;
				ctx.fill();
				// subtle rim light
				ctx.strokeStyle = 'rgba(255,255,255,0.85)';
				ctx.lineWidth = 1;
				ctx.stroke();
				// internal small cracks
				if (f.cracks && f.cracks.length) {
					ctx.save();
					ctx.clip();
					ctx.lineCap = 'round';
					for (const c of f.cracks) {
						ctx.strokeStyle = 'rgba(235,250,255,0.55)';
						ctx.lineWidth = 0.6;
						ctx.beginPath();
						for (let i = 0; i < c.points.length; i++) {
							const p = c.points[i];
							if (i === 0) ctx.moveTo(p.x, p.y);
							else ctx.lineTo(p.x, p.y);
						}
						ctx.stroke();
						// glow overlay
						ctx.strokeStyle = 'rgba(255,255,255,0.9)';
						ctx.lineWidth = 0.25;
						ctx.stroke();
					}
					ctx.restore();
				}
				ctx.restore();
			}
			// fracture dust draw
			if (this.fractureDust.length) {
				ctx.save();
				for (const d of this.fractureDust) {
					const p = d.life / d.maxLife;
					ctx.globalAlpha = (1 - p) * 0.6;
					ctx.fillStyle = 'rgba(225,240,255,1)';
					ctx.beginPath();
					ctx.arc(d.x, d.y, d.size * (0.7 + 0.3 * (1 - p)), 0, Math.PI * 2);
					ctx.fill();
				}
				ctx.restore();
			}
		}

		if (this.shards.length) {
			ctx.save();
			for (const s of this.shards) {
				const p = s.life / s.maxLife;
				const a = (1 - p) * 0.9;
				ctx.globalAlpha = a;
				ctx.fillStyle = 'rgba(210,240,255,1)';
				ctx.beginPath();
				ctx.moveTo(s.x, s.y);
				ctx.lineTo(s.x + s.size, s.y + s.size * 0.6);
				ctx.lineTo(s.x - s.size * 0.4, s.y + s.size);
				ctx.closePath();
				ctx.fill();
			}
			ctx.restore();
		}

		// pre-phase frost motes (draw above shards, below everything else)
		if (this.prePhaseFrost.length && this.state === 'normal' && this.landCount >= 2) {
			ctx.save();
			for (const f of this.prePhaseFrost) {
				const p = f.life / f.maxLife;
				ctx.globalAlpha = (1 - p) * 0.55;
				ctx.fillStyle = 'rgba(220,245,255,1)';
				ctx.beginPath();
				ctx.arc(f.x, f.y, f.size * (0.6 + 0.4 * (1 - p)), 0, Math.PI * 2);
				ctx.fill();
			}
			ctx.restore();
		}

		ctx.restore();
	}

	public resetToSpawn() {
		this.x = this.spawnX;
		this.y = this.spawnY;
		this.state = 'normal';
		this.landCount = 0;
		this.crackTimer = 0;
		this.highlightRect = null;
		this.highlightStrength = 0;
		this.highlightTarget = 0;
		this.fragments.length = 0;
		this.shards.length = 0;
		this.crackJitter = null;
		this.crackLines = null;
	}

	public getState(): string {
		return this['state'];
	}
}
