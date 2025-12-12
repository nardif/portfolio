// /app/game/core/GameManager.ts
import { Player } from './Player';
import { Platform } from './Platform';
import { InputHandler } from '../utils/InputHandler';
import { WorldScreenManager } from './WorldScreenManager';
import { placeCentered } from '../utils/placeCentered';
import { CircularPlatform } from './CircularPlatform';
import { InfoBubble } from './InfoBubble';

export class GameManager {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private input: InputHandler;
	private player: Player;

	public getPlayer(): Player {
		return this.player;
	}
	private platforms: Platform[];
	private lastTime = 0;
	private worldHeight = 1200;
	private scrollY = 0;
	private screenManager: WorldScreenManager;
	private circularPlatforms: CircularPlatform[];
	private targetScrollY: number | null = null;
	private pendingSpawnScreenId: string | null = null; // al hacer click en nav
	private bubbles: InfoBubble[] = [];

	constructor(
		canvas: HTMLCanvasElement,
		private onScreenChange?: (screenId: string | null) => void
	) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d')!;
		this.input = new InputHandler();

		const screenHeight = this.canvas.height;
		this.worldHeight = screenHeight * 10; // ← pantallas verticales

		//Inicializar pantallas
		this.screenManager = new WorldScreenManager([
			{
				id: 'screen-1-intro',
				yStart: 0,
				height: screenHeight,
			},
			{
				id: 'screen-2-about-me-1',
				yStart: screenHeight * 2,
				height: screenHeight,
			},
			{
				id: 'screen-3-about-me-2',
				yStart: screenHeight * 3,
				height: screenHeight,
				onEnter: () => {
					this.player.gravity = (14 / 225) * screenHeight;
					this.player.usePrecisePhysics = true;
				},
				onExit: () => {
					this.player.gravity = 1;
					this.player.usePrecisePhysics = false;
					this.player.vy = 2;
				},
			},
			{
				id: 'screen-4-about-me-3',
				yStart: screenHeight * 4,
				height: screenHeight,
				onEnter: () => {
					this.player.gravity = (14 / 225) * screenHeight;
					this.player.usePrecisePhysics = true;
				},
				onExit: () => {
					this.player.gravity = 1;
					this.player.usePrecisePhysics = false;
					this.player.vy = Math.max(this.player.vy, 2);
				},
			},
			{
				id: 'screen-5-about-me-4',
				yStart: screenHeight * 5,
				height: screenHeight,
				onExit: () => {
					this.player.gravity = 1;
					this.player.usePrecisePhysics = false;
					this.player.vy = Math.max(this.player.vy, 2);
				},
			},
			{
				id: 'screen-6-skills-1',
				yStart: screenHeight * 6,
				height: screenHeight,
			},
			{
				id: 'screen-7-skills-2',
				yStart: screenHeight * 7,
				height: screenHeight,
			},
			{
				id: 'screen-8-projects',
				yStart: screenHeight * 8,
				height: screenHeight,
			},
			{
				id: 'screen-9-contact',
				yStart: screenHeight * 9,
				height: screenHeight,
			},
		]);

		// Inicializar plataformas
		this.circularPlatforms = [
			new CircularPlatform(this.canvas.width / 2, screenHeight / 2 + 350, 300),
		];

		this.platforms = [
			// 🟡 Screen 6 - skills-1
			new Platform(
				placeCentered(this.canvas, -300, screenHeight * 6 + 100, 200),
				screenHeight * 6 + 420,
				250,
				20
			),
			new Platform(
				placeCentered(this.canvas, 0, screenHeight * 6 + 180, 200),
				screenHeight * 6 + 480,
				220,
				20
			),
			new Platform(
				placeCentered(this.canvas, 275, screenHeight * 6 + 180, 200),
				screenHeight * 6 + 380,
				80,
				20
			),
			new Platform(
				placeCentered(this.canvas, 400, screenHeight * 6 + 180, 200),
				screenHeight * 6 + 290,
				100,
				20
			),

			// 🟢 Screen 7 - skills-2
			new Platform(
				placeCentered(this.canvas, -150, screenHeight * 7 + 80, 200),
				screenHeight * 7 + 320,
				280,
				20
			),
			new Platform(
				placeCentered(this.canvas, 200, screenHeight * 7 + 200, 200),
				screenHeight * 7 + 400,
				200,
				20
			),
		];

		// EJEMPLO: Solo burbujas en plataformas específicas y con texto personalizado
		// Puedes editar este array para elegir en qué plataformas y qué texto mostrar
		const bubbleConfigs = [
			{ platformIndex: 1, text: 'Frontend  ' }, // plataforma central de screen 6
			{ platformIndex: 3, text: 'Backend  ' }, // plataforma lateral derecha
			{ platformIndex: 4, text: 'Databases  ' }, // primera de screen 7
		];
		bubbleConfigs.forEach((cfg) => {
			const plat = this.platforms[cfg.platformIndex];
			if (plat) {
				this.bubbles.push(new InfoBubble(plat.x + plat.width / 2, plat.y - 40, 38, cfg.text));
			}
		});

		// Spawn inicial en el planeta
		const planet = this.circularPlatforms[0];
		this.player = new Player(planet.x - 24, planet.y - planet.radius - 48 - 4);

		// Sincronizar estado de pantalla al montar
		this.screenManager.update(this.player.y);
		const currentScreenId = this.screenManager.getCurrentScreen()?.id ?? null;
		if (this.onScreenChange) this.onScreenChange(currentScreenId);
	}

	// Navegar a una pantalla por id (para la navbar)
	public goToScreen(screenId: string, opts: { smooth?: boolean } = { smooth: true }) {
		const screen = this.screenManager.getScreens().find((s) => s.id === screenId);
		if (!screen) return;

		const desired = Math.max(0, Math.min(screen.yStart, this.worldHeight - this.canvas.height));

		if (opts.smooth) {
			this.targetScrollY = desired;
			this.pendingSpawnScreenId = screen.id;
		} else {
			this.scrollY = desired;
			this.targetScrollY = null;
			this.snapSpawnToScreen(screen.id);
		}
	}

	update(dt: number) {
		// 1) físicas/colisiones
		this.circularPlatforms.forEach((p) => p.update(dt, this.player));
		this.player.update(dt, this.input, this.platforms);
		// Update & highlight platforms
		for (const p of this.platforms) {
			if (typeof p.update === 'function') p.update(dt);
			if (typeof p.updateHighlight === 'function') p.updateHighlight(dt, this.player);
		}
		this.bubbles.forEach((b) => b.update(dt, this.player));

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

		// 3) límites del mundo
		if (this.player.y > this.worldHeight) this.respawnPlayer();

		// 4) screen manager
		this.screenManager.update(this.player.y);

		// 5) notificar UI
		const currentScreenId = this.screenManager.getCurrentScreen()?.id ?? null;
		if (this.onScreenChange) this.onScreenChange(currentScreenId);
	}

	draw() {
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.ctx.save();
		this.ctx.translate(0, -this.scrollY);

		// Orden de pintado: plataformas / planeta / burbujas / player
		this.platforms.forEach((p) => p.draw(this.ctx));
		this.circularPlatforms.forEach((p) => p.draw(this.ctx));
		this.bubbles.forEach((b) => b.draw(this.ctx));
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

	private getCustomSpawn(screenId: string): { x: number; y: number } | null {
		if (screenId === 'screen-2-about-me-1') {
			const centerX = this.canvas.width / 2;
			const y = this.canvas.height * 2 + 120; // pantalla 2, poco por debajo del inicio
			return { x: centerX - this.player.width / 2, y };
		}
		return null;
	}

	private respawnPlayer() {
		const planet = this.circularPlatforms[0];
		this.player.respawnAt(
			planet.x - this.player.width / 2,
			planet.y - planet.radius - this.player.height
		);
		// Al respawnear desde el vacío restaurar plataformas destruidas
		for (const p of this.platforms) {
			if (typeof p.resetToSpawn === 'function') p.resetToSpawn();
		}
	}

	private snapSpawnToScreen(screenId: string) {
		const screen = this.screenManager.getScreens().find((s) => s.id === screenId);
		if (!screen) return;

		if (screenId === 'screen-1-intro') {
			const planet = this.circularPlatforms[0];
			const x = planet.x - this.player.width / 2;
			const y = planet.y - planet.radius - this.player.height;
			this.player.respawnAt(x, y);
			this.player.startSpawnFx('fade-pop', 420);
			return;
		}

		const yMin = screen.yStart;
		const yMax = screen.yStart + screen.height;
		const margin = 100;
		const plat = this.platforms.find(
			(p) => p.y + p.height / 2 >= yMin - margin && p.y <= yMax + margin
		);

		if (plat) {
			const x = plat.x + plat.width / 2 - this.player.width / 2;
			const y = plat.y - this.player.height;
			this.player.respawnAt(x, y);
			this.player.startSpawnFx('fade-pop', 420);
			return;
		}

		// 🆕 Si no hay plataformas, usar custom spawn solo para screen-2-about-me-1
		const custom = this.getCustomSpawn(screen.id);
		if (custom) {
			this.player.respawnAt(custom.x, custom.y);
			this.player.startSpawnFx('fade-pop', 420);
		}
	}
}
