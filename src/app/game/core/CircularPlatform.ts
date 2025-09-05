import { GameObject } from './GameObject';
import { Player } from './Player';

export class CircularPlatform implements GameObject {
	public angle: number = 0;
	public rotationSpeed: number = 0.01;
	private sprite: HTMLImageElement;

	constructor(
		public x: number,
		public y: number,
		public radius: number
	) {
		this.sprite = new Image();
		this.sprite.src = '/platforms/planet.png';
	}
	// Estas dos propiedades son requeridas por GameObject
	get width(): number {
		return this.radius * 2;
	}
	get height(): number {
		return this.radius * 2;
	}

	update(dt: number, player: Player) {
		const playerCenterx = player.x + player.width / 2;
		const playerBottomY = player.y + player.height;

		const dx = playerCenterx - this.x;
		const dy = this.y - playerBottomY;
		const distance = Math.sqrt(dx * dx + dy * dy);

		const collisionDistance = this.radius;
		const colliding = distance <= collisionDistance;

		if (colliding) {
			const angle = Math.atan2(-dy, dx);
			const isAbove = dy > 0 && Math.abs(dx) < this.radius * 1.05;
			const isLanding = isAbove && (player.vy >= 0 || player.onGround === false);

			if (isLanding) {
				// Posicionar al jugador justo en el perímetro
				const surfaceX = this.x + Math.cos(angle) * this.radius;
				const surfaceY = this.y + Math.sin(angle) * this.radius;

				// Reposicionamos al jugador empujándolo fuera del planeta
				player.x = surfaceX - player.width / 2;
				player.y = surfaceY - player.height;

				// Cancelar velocidad solo si venía cayendo
				player.vy = 0;
				player.setOnGround(true);
			}

			// 🔸 SOLO girar si el jugador se mueve en X (a/d)
			if (Math.abs(player.vx) > 0.01) {
				const direction = player.getFacing(); // "left" | "right"
				const signed = direction === 'left' ? 1 : -1; // opuesto a la mirada
				this.angle += signed * this.rotationSpeed * (dt / 16.67);
			}
		}
		// (Opcional) amortiguar giro cuando NO hay input o NO hay colisión
		// para que se detenga suave en lugar de quedar con “deriva”.
		if (!colliding || Math.abs(player.vx) <= 0.01) {
			const damping = 0.94;
			this.angle *= damping;
			if (Math.abs(this.angle) < 0.0001) this.angle = 0;
		}
	}

	draw(ctx: CanvasRenderingContext2D, debug: boolean = false) {
		ctx.save();
		ctx.translate(this.x, this.y);
		ctx.rotate(this.angle);

		if (this.sprite.complete && this.sprite.naturalWidth > 0) {
			ctx.drawImage(this.sprite, -this.radius, -this.radius, this.radius * 2, this.radius * 2);
		} else {
			// fallback por si no carga
			ctx.beginPath();
			ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
			ctx.fillStyle = '#0a3647ff';
			ctx.fill();
		}

		ctx.restore();
	}
}
