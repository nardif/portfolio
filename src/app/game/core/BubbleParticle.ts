// core/BubbleParticle.ts
export class BubbleParticle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	r: number;
	life = 0;
	readonly ttl: number;
	readonly startR: number;

	constructor(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.vx = (Math.random() - 0.5) * 0.35;
		this.vy = -(0.9 + Math.random() * 0.8); // suben más rápido
		this.r = this.startR = 3 + Math.random() * 3;
		this.ttl = 700 + Math.random() * 450; // ⬅️ antes 0.9–1.6s; ahora ~0.7–1.15s
	}

	update(dt: number) {
		this.x += this.vx;
		this.y += this.vy;
		this.life += dt;

		// achicar el radio más notorio hacia el final
		const t = Math.min(1, this.life / this.ttl);
		this.r = this.startR * (1 - 0.75 * t); // cae al 25%

		// kill duro por si acaso
		if (this.life >= this.ttl) this.life = this.ttl;
	}

	get dead() {
		return this.life >= this.ttl;
	}

	draw(ctx: CanvasRenderingContext2D) {
		const t = Math.max(0, 1 - this.life / this.ttl);
		// curva más agresiva para alpha
		const alpha = Math.pow(t, 2.2); // ⬅️ cae más rápido
		if (alpha < 0.02) return; // ⬅️ no dibujar casi invisibles

		ctx.save();
		ctx.globalAlpha = 0.9 * alpha;

		ctx.beginPath();
		ctx.arc(this.x, this.y, Math.max(0.4, this.r), 0, Math.PI * 2);

		const R = Math.max(1, this.r);
		const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, R);
		g.addColorStop(0, 'rgba(180,240,255,0.85)');
		g.addColorStop(1, 'rgba(110,200,255,0.10)');
		ctx.fillStyle = g;
		ctx.fill();

		ctx.restore();
	}
}
