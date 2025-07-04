// core/Platform.ts
import { GameObject } from "./GameObject";

export class Platform implements GameObject {
  constructor(
    public x: number,
    public y: number,
    public width: number,
    public height: number
  ) {}

  update(_: number) {}

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = "brown";
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}
