// core/Player.ts
import { GameObject } from "./GameObject";
import { Platform } from "./Platform";
import { checkCollision, resolveCollision } from "./Physics";
import { UpdatableWithContext } from "./UpdatableWithContext";
import { InputHandler } from "../utils/InputHandler";
import { SpriteAnimator, AnimationState } from "./SpriteAnimator";

export class Player implements GameObject, UpdatableWithContext {
    public width = 48;
    public height = 48;
    public vx = 0;
    public vy = 0;
    public speed = 3;
    public gravity = 1;
    public onGround = false;

    private facing: 'left' | 'right' = 'right';
    private animator: SpriteAnimator;

    constructor(public x: number, public y: number) {
        this.animator = new SpriteAnimator(
            '/sprites/pikminYellow.png',
            256,
            256,
            {
                idle: { row: 1, frames: 1 },
                walk: { row: 0, frames: 4 },
                jump: { row: 2, frames: 4 },
            },
            100
        );
    }

    update(dt: number, input: InputHandler, platforms: Platform[], canvas: HTMLCanvasElement) {
        this.vx = 0;

        // Dirección y movimiento
        if (input.isActionPressed("left")) {
            this.vx = -this.speed;
            this.facing = 'left';
        }
        if (input.isActionPressed("right")) {
            this.vx = this.speed;
            this.facing = 'right';
    }

        // Salto
        if (input.isActionPressed("jump") && this.onGround) {
        this.vy = -14;
        this.onGround = false;
        }

        // Gravedad
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;

        // Resetear estado de suelo
        this.onGround = false;

        // Colisiones con plataformas
        for (const p of platforms) {
            if (checkCollision(this, p)) {
                resolveCollision(this, p);
            }
        }
        
        //Elegir animación
        let newState: AnimationState = 'idle';
        if(!this.onGround) newState = 'jump';
        else if(this.vx !==0) newState = 'walk';

        this.animator.setState(newState);
        this.animator.update(dt);
    }

    respawnAt(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vy = 0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        this.animator.draw(
            ctx,
            this.x,
            this.y,
            this.width,
            this.height,
            this.facing === 'left'
        );
    }
}
