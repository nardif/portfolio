// core/GameObject.ts
export interface GameObject {
  x: number;
  y: number;
  width: number;
  height: number;
  draw(ctx: CanvasRenderingContext2D): void;
}
