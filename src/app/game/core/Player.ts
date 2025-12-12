// core/Player.ts
import { GameObject } from './GameObject';
import { Platform } from './Platform';
import { checkCollision, resolveCollision } from './Physics';
import { UpdatableWithContext } from './UpdatableWithContext';
import { InputHandler } from '../utils/InputHandler';
import { SpriteAnimator, AnimationState } from './SpriteAnimator';

export class Player implements GameObject, UpdatableWithContext {
	public width = 48;
	public height = 60;
	public vx = 0;
	public vy = 0;
	public speed = 3;
	public gravity = 0.8;
	public onGround = false;
	public wasOnGround = false; // track previous frame ground state
	public usePrecisePhysics = false;

	private facing: 'left' | 'right' = 'right';
	private animator: SpriteAnimator;
	private spawnFx = {
		active: false,
		t: 0,
		duration: 400,
		type: 'fade-pop' as 'fade' | 'pop' | 'fade-pop',
	};

	constructor(
		public x: number,
		public y: number
	) {
		this.animator = new SpriteAnimator(
			'/sprites/pikminYellow.png',
			208,
			281,
			{
				idle: { row: 1, frames: 1 },
				walk: { row: 0, frames: 4 },
				jump: { row: 2, frames: 4 },
			},
			100
		);
	}

	update(dt: number, input: InputHandler, platforms: Platform[]) {
		this.wasOnGround = this.onGround;
		this.vx = 0;

		// Dirección y movimiento
		if (input.isActionPressed('left')) {
			this.vx = -this.speed;
			this.facing = 'left';
		}
		if (input.isActionPressed('right')) {
			this.vx = this.speed;
			this.facing = 'right';
		}

		// Salto
		if (input.isActionPressed('jump') && this.onGround) {
			this.vy = -16;
			this.onGround = false;
		}

		// Guardamos posición anterior para anti-tunneling
		const prevY = this.y;

		// Gravedad
		if (this.usePrecisePhysics) {
			const dtSec = dt / 1000;
			this.vy += this.gravity * dtSec;
			this.x += this.vx;
			this.y += this.vy * dtSec;
		} else {
			this.vy += this.gravity; // frame-based
			this.x += this.vx;
			this.y += this.vy;
		}

		// Resetear estado de suelo (se recalculará en colisiones)
		this.onGround = false;

		//   ANTI-TUNNELING VERTICAL FIX
		for (const p of platforms) {
			// ¿El jugador cruzó la superficie de la plataforma entre prevY y y?
			const crossedDown =
				prevY + this.height <= p.y && // Antes estaba arriba
				this.y + this.height >= p.y && // Ahora está abajo
				this.vy > 0 && // Debe ir cayendo
				this.x + this.width > p.x && // Solapamiento X
				this.x < p.x + p.width;

			if (crossedDown && typeof p.isCollidable === 'function' && p.isCollidable()) {
				this.y = p.y - this.height;
				this.vy = 0;
				this.onGround = true;

				if (!this.wasOnGround && typeof p.registerLanding === 'function') {
					p.registerLanding();
				}
			}
		}
		// Colisiones con plataformas
		for (const p of platforms) {
			if (checkCollision(this, p)) {
				resolveCollision(this, p);
			}
		}

		//Elegir animación
		let newState: AnimationState = 'idle';
		if (!this.onGround) newState = 'jump';
		else if (this.vx !== 0) newState = 'walk';

		this.animator.setState(newState);
		this.animator.update(dt);

		this.updateSpawnFx(dt);
	}

	respawnAt(x: number, y: number) {
		this.x = x;
		this.y = y;
		this.vy = 0;
	}

	// Disparar animación de respawn
	public startSpawnFx(type: 'fade' | 'pop' | 'fade-pop' = 'fade-pop', duration = 400) {
		this.spawnFx.active = true;
		this.spawnFx.t = 0;
		this.spawnFx.duration = duration;
		this.spawnFx.type = type;
	}

	// Avance temporal del FX
	private updateSpawnFx(dt: number) {
		if (!this.spawnFx.active) return;
		this.spawnFx.t += dt;
		if (this.spawnFx.t >= this.spawnFx.duration) this.spawnFx.active = false;
	}

	draw(ctx: CanvasRenderingContext2D) {
		// Aplicar fade/scale si el FX está activo
		const fx = this.spawnFx;
		let scale = 1;
		let alpha = 1;

		if (fx.active) {
			const p = Math.min(1, fx.t / fx.duration);
			// easing suave (cubic out)
			const e = 1 - Math.pow(1 - p, 3);

			switch (fx.type) {
				case 'fade':
					alpha = e; // 0 → 1
					scale = 1;
					break;
				case 'pop':
					alpha = 1;
					scale = 0.85 + 0.25 * e; // 0.85 → 1.10
					break;
				case 'fade-pop':
				default:
					alpha = e; // 0 → 1
					scale = 0.9 + 0.2 * e; // 0.9 → 1.1
					break;
			}
		}

		ctx.save();
		if (fx.active) {
			const cx = this.x + this.width / 2;
			const cy = this.y + this.height / 2;
			ctx.globalAlpha *= alpha;
			ctx.translate(cx, cy);
			ctx.scale(scale, scale);
			ctx.translate(-cx, -cy);
		}

		this.animator.draw(ctx, this.x, this.y, this.width, this.height, this.facing === 'left');

		ctx.restore();
	}

	getFacing(): 'left' | 'right' {
		return this.facing;
	}
	setOnGround(state: boolean) {
		this.onGround = state;
	}
}
