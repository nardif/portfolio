// core/Player.ts
import { GameObject } from "./GameObject";
import { Platform } from "./Platform";
import { checkCollision, resolveCollision } from "./Physics";
import { UpdatableWithContext } from "./UpdatableWithContext";
import { InputHandler } from "../utils/InputHandler";

export class Player implements GameObject, UpdatableWithContext {
    public width = 48;
    public height = 48;
    public vx = 0;
    public vy = 0;
    public speed = 3;
    public gravity = 1;
    public onGround = false;

    private sprite: HTMLImageElement;
    private totalFrames = 4;
    private currentFrame = 0;
    private frameWidth = 256;
    private frameHeight = 256;
    private frameTimer = 0;
    private frameInterval = 100; 

    private facing: 'left' | 'right' = 'right';
    private animationRow = 0;

    constructor(public x: number, public y: number) {
        this.sprite = new Image();
        this.sprite.src = '/sprites/pikminYellow.png';
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
        if (!this.onGround) {   //jump
            this.animationRow = 2;
        } else if (this.vx !== 0) { //walk
            this.animationRow = 0
        } else {    //standing
            this.currentFrame = 0
        }

        //Animar solo si se mueve o salta
        if (this.vx !== 0 || !this.onGround) {
            this.frameTimer += dt;
            if (this.frameTimer >= this.frameInterval) {
                this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
                this.frameTimer = 0;
            }
        } else {
            this.currentFrame = 0;
        }
    }

    respawnAt(x: number, y: number) {
        this.x = x;
        this.y = y;
        this.vy = 0;
    }

    draw(ctx: CanvasRenderingContext2D) {
        if (!this.sprite.complete || this.sprite.naturalWidth === 0) {
             //or throw error: implementar mas adelante
              ctx.fillStyle = "blue";
            ctx.fillRect(this.x, this.y, this.width, this.height);
            return;
        }

        const sx = this.currentFrame * this.frameWidth;
        const sy = this.animationRow * this.frameHeight;

        ctx.save();

        if (this.facing === 'left') {
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.scale(-1, 1);
            ctx.translate(-this.width/2, -this.width/2);
            ctx.drawImage(
                this.sprite,
                sx, sy,
                this.frameWidth, this.frameHeight,
                0, 0,
                this.width, this.height
            );
        } else {
            ctx.drawImage(
                this.sprite,
                sx, sy,
                this.frameWidth, this.frameHeight,
                this.x, this.y,
                this.width, this.height
            );
        }

        ctx.restore();
    }
}
