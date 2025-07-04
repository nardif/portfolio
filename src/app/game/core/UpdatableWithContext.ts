import { InputHandler } from "../utils/InputHandler";
import { GameObject } from "./GameObject";

export interface UpdatableWithContext {
  update(
    dt: number,
    input: InputHandler,
    platforms: GameObject[],
    canvas: HTMLCanvasElement
  ): void;
}
