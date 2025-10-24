// /app/game/core/InfoBubble.ts
import { Player } from './Player';

export type BubbleState = 'idle' | 'triggered' | 'cooldown';

type BubbleEventShow = { id: string; x: number; y: number; text: string };
type BubbleEventMove = { id: string; x: number; y: number };
type BubbleEventHide = { id: string };

export class InfoBubble {
	public readonly id: string;

	x: number;
	y: number;
	readonly spawnX: number;
	readonly spawnY: number;

	readonly baseR: number; // radio de colisión/dibujo
	text: string;
	state: BubbleState = 'idle';

	// Animación simple: flotar hacia arriba y desvanecer
	private t = 0;
	private readonly floatMs = 3500; // Increased visible time
	private readonly risePx = 80;

	// Respawn básico (si querés que reaparezcan)
	private respawnDelay = 5000;
	private respawnTimer = 0;

	// Edge trigger (evita disparos continuos al estar en contacto)
	private wasOverlapping = false;

	constructor(x: number, y: number, radius: number, text: string) {
		this.id = `bubble-${Math.random().toString(36).slice(2, 9)}`;
		this.x = x;
		this.y = y;
		this.spawnX = x;
		this.spawnY = y;
		this.baseR = radius;
		this.text = text;
	}

	private dispatch<T>(type: string, detail: T) {
		window.dispatchEvent(new CustomEvent<T>(type, { detail }));
	}

	/** Colisión simple rect (player) vs círculo (burbuja). */
	overlapsPlayer(p: Player): boolean {
		const closestX = Math.max(p.x, Math.min(this.x, p.x + p.width));
		const closestY = Math.max(p.y, Math.min(this.y, p.y + p.height));
		const dx = this.x - closestX;
		const dy = this.y - closestY;
		return dx * dx + dy * dy <= this.baseR * this.baseR;
	}

	trigger() {
		if (this.state !== 'idle') return;
		this.state = 'triggered';
		this.t = 0;
		// mostrar label HTML
		this.dispatch<BubbleEventShow>('bubble:show', {
			id: this.id,
			x: this.x,
			y: this.y,
			text: this.text,
		});
	}

	private resetToIdle() {
		this.state = 'idle';
		this.t = 0;
		this.x = this.spawnX;
		this.y = this.spawnY;
		this.wasOverlapping = false;
	}

	update(dt: number, player: Player) {
		const overlapping = this.overlapsPlayer(player);

		if (this.state === 'idle') {
			// edge trigger: entra cuando pasa de no-colisionar → colisionar
			if (overlapping && !this.wasOverlapping) {
				this.trigger();
			}
		} else if (this.state === 'triggered') {
			this.t += dt;
			// movimiento hacia arriba
			const dy = (this.risePx / this.floatMs) * dt;
			this.y -= dy;

			// mover label HTML
			this.dispatch<BubbleEventMove>('bubble:move', { id: this.id, x: this.x, y: this.y });

			if (this.t >= this.floatMs) {
				// ocultar label y pasar a cooldown
				this.state = 'cooldown';
				this.respawnTimer = 0;
				this.dispatch<BubbleEventHide>('bubble:hide', { id: this.id });
			}
		} else if (this.state === 'cooldown') {
			this.respawnTimer += dt;
			if (this.respawnTimer >= this.respawnDelay) {
				this.resetToIdle();
			}
		}

		this.wasOverlapping = overlapping;
	}

	draw(ctx: CanvasRenderingContext2D) {
		// No dibujar nada durante cooldown (desaparece por completo)
		if (this.state === 'cooldown') {
			return;
		}
		ctx.save();

		// Fade-out alpha logic
		let alpha = 1;
		if (this.state === 'triggered') {
			const fadeDuration = 700; // ms for fade-out
			if (this.t > this.floatMs - fadeDuration) {
				alpha = 1 - (this.t - (this.floatMs - fadeDuration)) / fadeDuration;
				alpha = Math.max(0, Math.min(1, alpha));
			}
		}
		ctx.globalAlpha = alpha;

		// respiración leve
		const breathe = 1 + 0.06 * Math.sin(performance.now() * 0.004);
		let R = this.baseR * breathe;

		// Si está triggered, agrandar según cantidad de texto
		if (this.state === 'triggered') {
			// Medir cantidad de líneas y longitud máxima
			const ctxFont = `bold 22px 'Quivert', Arial, sans-serif`;
			ctx.save();
			ctx.font = ctxFont;
			// Wrap simple: dividir por espacios y saltos de línea
			const words = this.text.split(/\s+/);
			const lines: string[] = [];
			let current = '';
			for (const word of words) {
				const test = current ? current + ' ' + word : word;
				if (ctx.measureText(test).width > this.baseR * 1.6) {
					lines.push(current);
					current = word;
				} else {
					current = test;
				}
			}
			if (current) lines.push(current);
			const maxLine = Math.max(...lines.map((l) => ctx.measureText(l).width), 0);
			const minR = this.baseR * 1.1;
			const textR = Math.max(minR, maxLine / 1.7, lines.length * 22);
			R = Math.max(R, textR);
			ctx.restore();
		}

		// relleno translucido
		const g = ctx.createRadialGradient(this.x, this.y, R * 0.1, this.x, this.y, R);
		g.addColorStop(0, 'rgba(200,240,255,0.30)');
		g.addColorStop(1, 'rgba(120,200,255,0.08)');
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.arc(this.x, this.y, R, 0, Math.PI * 2);
		ctx.fill();

		// borde
		ctx.lineWidth = Math.max(1.5, R * 0.06);
		ctx.strokeStyle = 'rgba(160,220,255,0.7)';
		ctx.beginPath();
		ctx.arc(this.x, this.y, R - ctx.lineWidth * 0.5, 0, Math.PI * 2);
		ctx.stroke();

		// brillo que recorre el borde
		const sweep = (performance.now() * 0.002) % (Math.PI * 2);
		const arcW = 0.55;
		ctx.lineCap = 'round';
		const glow = ctx.createLinearGradient(
			this.x + Math.cos(sweep - arcW) * R,
			this.y + Math.sin(sweep - arcW) * R,
			this.x + Math.cos(sweep + arcW) * R,
			this.y + Math.sin(sweep + arcW) * R
		);
		glow.addColorStop(0.0, 'rgba(160,220,255,0.00)');
		glow.addColorStop(0.5, 'rgba(200,250,255,0.85)');
		glow.addColorStop(1.0, 'rgba(160,220,255,0.00)');
		ctx.strokeStyle = glow;
		ctx.beginPath();
		ctx.arc(this.x, this.y, R - ctx.lineWidth * 0.5, sweep - arcW, sweep + arcW);
		ctx.stroke();

		// DIBUJAR TEXTO SOLO SI ESTÁ TRIGGERED
		if (this.state === 'triggered') {
			ctx.save();
			ctx.beginPath();
			ctx.arc(this.x, this.y, R - 4, 0, Math.PI * 2);
			ctx.clip();
			ctx.font = `bold 22px 'Quivert', Arial, sans-serif`;
			ctx.fillStyle = '#fff';
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			// Si el texto es largo, hacer wrap
			const lines = this.text.split(/\n|(?<=\s)/g).reduce(
				(acc, word) => {
					const last = acc[acc.length - 1] || '';
					const test = last + word;
					if (ctx.measureText(test).width > R * 1.6) acc.push(word);
					else acc[acc.length - 1] = test;
					return acc;
				},
				[''] as string[]
			);
			const lineHeight = 24;
			const totalHeight = lines.length * lineHeight;
			lines.forEach((line, i) => {
				ctx.fillText(
					line.trim(),
					this.x,
					this.y - totalHeight / 2 + i * lineHeight + lineHeight / 2
				);
			});
			ctx.restore();
		}

		ctx.restore();
	}
}
