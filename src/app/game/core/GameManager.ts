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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.input = new InputHandler();

    // Inicializar plataformas
    this.platforms = [
      new Platform(100, 400, 200, 20),
      new Platform(250, 485, 200, 20),
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

    // Verificar si el jugador se cae del canvas
    if (this.player.y > this.canvas.height) {
      this.respawnPlayer();
    }
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.platforms.forEach(p => p.draw(this.ctx));
    this.player.draw(this.ctx);
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
