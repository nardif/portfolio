// core/GameManager.ts
import { Player } from "./Player";
import { Platform } from "./Platform";
import { InputHandler } from "../utils/InputHandler";

export class GameManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private input: InputHandler;
  private player: Player;
  private platforms: Platform[];
  private lastTime = 0;
  private worldHeight = 1200;
  private scrollY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.input = new InputHandler();

    // Inicializar plataformas
    this.platforms = [
      new Platform(100, 400, 200, 20),
      new Platform(250, 485, 200, 20),

      new Platform(120, 700, 200, 20),
      new Platform(300, 850, 200, 20),
    ];

    // Inicializar jugador sobre la primera plataforma
    const start = this.platforms[0];
    this.player = new Player(
      start.x + start.width / 2 - 20,
      start.y - 40
    );
  }

  update(dt: number) {
    this.player.update(dt, this.input, this.platforms, this.canvas);

    //seguir al jugador dentro del mundo
    const halfCanvas = this.canvas.height / 2;
    const targetScroll = this.player.y + this.player.height / 2 - halfCanvas;

    // Limitar el scroll para no salir del mundo
    this.scrollY = Math.max(0, Math.min(targetScroll, this.worldHeight - this.canvas.height));

    // Verificar si el jugador se cae del canvas
    if (this.player.y > this.worldHeight) {
      this.respawnPlayer();
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(0, -this.scrollY);

    this.platforms.forEach(p => p.draw(this.ctx));
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
    const start = this.platforms[0];
    this.player.respawnAt(
      start.x + start.width / 2 - this.player.width / 2,
      start.y - this.player.height
    );
  }
}
