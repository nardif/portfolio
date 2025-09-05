// core/GameManager.ts
import { Player } from './Player';
import { Platform } from './Platform';
import { InputHandler } from '../utils/InputHandler';
import { WorldScreenManager } from './WorldScreenManager';
import { placeCentered } from '../utils/placeCentered';
import { CircularPlatform } from './CircularPlatform';

export class GameManager {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private input: InputHandler;
	private player: Player;
	private platforms: Platform[];
	private lastTime = 0;
	private worldHeight = 1200;
	private scrollY = 0;
	private screenManager: WorldScreenManager;
	private circularPlatforms: CircularPlatform[];
	private targetScrollY: number | null = null;
	private pendingSpawnScreenId: string | null = null; // al hacer click en nav

	constructor(
		canvas: HTMLCanvasElement,
		private onScreenChange?: (screenId: string | null) => void
	) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
		this.input = new InputHandler();

		const screenHeight = this.canvas.height;
		this.worldHeight = screenHeight * 3; // ← 3 pantallas verticales

		//Inicializar pantallas
		this.screenManager = new WorldScreenManager([
			{
				id: 'screen-1',
				yStart: 0,
				height: screenHeight,
				onEnter: () => {
					//cambiar settings, animacion, etc
				},
			},
			{
				id: 'screen-2',
				yStart: screenHeight,
				height: screenHeight,
				onEnter: () => {},
			},
			{
				id: 'screen-3',
				yStart: screenHeight * 2,
				height: screenHeight,
				onEnter: () => {},
			},
		]);

		// Inicializar plataformas
		// Pantalla 1
		this.circularPlatforms = [
			new CircularPlatform(this.canvas.width / 2, screenHeight / 2 + 350, 300),
		];

		this.platforms = [
			new Platform(
				placeCentered(this.canvas, -300, screenHeight + 100, 200),
				screenHeight + 450,
				250,
				20
			),
			new Platform(
				placeCentered(this.canvas, 0, screenHeight + 180, 200),
				screenHeight + 490,
				220,
				20
			),

			new Platform(
				placeCentered(this.canvas, -120, screenHeight * 2 + 80, 200),
				screenHeight * 2 + 320,
				300,
				20
			),
			new Platform(
				placeCentered(this.canvas, 150, screenHeight * 2 + 230, 200),
				screenHeight * 2 + 480,
				180,
				20
			),
		];

		// Spawn del jugador: sobre el planeta (pantalla 1)
		const planet = this.circularPlatforms[0];
		this.player = new Player(
			planet.x - 24, // centrado horizontalmente (48 = player.width)
			planet.y - planet.radius - 48 - 4 // encima del planeta
		);

		this.screenManager.update(this.player.y);
		const currentScreenId = this.screenManager.getCurrentScreen()?.id ?? null;
		if (this.onScreenChange) this.onScreenChange(currentScreenId);
	}

	// Navegar a una pantalla por id
	public goToScreen(screenId: string, opts: { smooth?: boolean } = { smooth: true }) {
		const screen = this.screenManager.getScreens().find((s) => s.id === screenId);
		if (!screen) return;

		const desired = Math.max(0, Math.min(screen.yStart, this.worldHeight - this.canvas.height));

		if (opts.smooth) {
			this.targetScrollY = desired;
			this.pendingSpawnScreenId = screen.id; // al llegar, hacemos respawn
		} else {
			this.scrollY = desired;
			this.targetScrollY = null;
			// respawnear en salto instantáneo:
			this.snapSpawnToScreen(screen.id);
		}
	}

	update(dt: number) {
		// 1) físicas/colisiones
		this.circularPlatforms.forEach((p) => p.update(dt, this.player));
		this.player.update(dt, this.input, this.platforms, this.canvas);

		// 2) cámara
		if (this.targetScrollY == null) {
			// seguir al jugador cuando NO estamos navegando por navbar
			const halfHeight = this.canvas.height / 2;
			const follow = this.player.y + this.player.height / 2 - halfHeight;
			this.scrollY = Math.max(0, Math.min(follow, this.worldHeight - this.canvas.height));
		} else {
			// animación suave hacia el destino cuando SÍ estamos navegando por navbar
			const ease = 0.12; // ajustá a gusto
			this.scrollY += (this.targetScrollY - this.scrollY) * ease;

			// snap cuando llegamos
			if (Math.abs(this.scrollY - this.targetScrollY) < 0.6) {
				this.scrollY = this.targetScrollY;
				this.targetScrollY = null;

				// respawn SOLO cuando terminó la navegación por navbar
				if (this.pendingSpawnScreenId) {
					this.snapSpawnToScreen(this.pendingSpawnScreenId);
					this.pendingSpawnScreenId = null;
				}
			}
		}

		// 3) límites del mundo + screen manager
		if (this.player.y > this.worldHeight) {
			this.respawnPlayer();
		}

		// 4) ACTUALIZAR el screen manager con la Y del jugador
		this.screenManager.update(this.player.y);

		// 5) recién ahora notificamos al UI
		const currentScreenId = this.screenManager.getCurrentScreen()?.id ?? null;
		if (this.onScreenChange) this.onScreenChange(currentScreenId);
	}

	draw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

		this.ctx.save();

		const screen = this.screenManager.getCurrentScreen();

		this.ctx.translate(0, -this.scrollY);

		this.platforms.forEach((p) => p.draw(this.ctx));
		this.circularPlatforms.forEach((p) => p.draw(this.ctx, true));
		this.player.draw(this.ctx);

		this.ctx.restore();
	}

	loop = (timestamp: number = 0) => {
		const dt = timestamp - this.lastTime;
		this.lastTime = timestamp;

		this.update(dt);
		this.draw();
		requestAnimationFrame(this.loop);
	};

	start() {
		this.lastTime = performance.now();
		this.loop();
	}

	dispose() {
		this.input.dispose();
	}

	private respawnPlayer() {
		const planet = this.circularPlatforms[0];
		this.player.respawnAt(
			planet.x - this.player.width / 2,
			planet.y - planet.radius - this.player.height
		);
	}

	// Respawn según pantalla
	private snapSpawnToScreen(screenId: string) {
		const screen = this.screenManager.getScreens().find((s) => s.id === screenId);
		if (!screen) return;

		if (screenId === 'screen-1') {
			const planet = this.circularPlatforms[0];
			const x = planet.x - this.player.width / 2;
			const y = planet.y - planet.radius - this.player.height;
			this.player.respawnAt(x, y);
			this.player.startSpawnFx('fade-pop', 420); // opciones: 'fade' | 'pop' | 'fade-pop'
			return;
		}

		// Para pantallas con plataformas rectas:
		// Buscamos una plataforma cuyo Y esté dentro del rango de la pantalla
		const yMin = screen.yStart;
		const yMax = screen.yStart + screen.height;

		const plat = this.platforms.find((p) => p.y >= yMin && p.y + p.height <= yMax);
		if (plat) {
			const x = plat.x + plat.width / 2 - this.player.width / 2;
			const y = plat.y - this.player.height;
			this.player.respawnAt(x, y);
			this.player.startSpawnFx('fade-pop', 420); // opciones: 'fade' | 'pop' | 'fade-pop'
		}
	}
}
