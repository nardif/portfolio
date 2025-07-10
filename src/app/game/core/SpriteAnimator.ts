export type AnimationState = 'idle' | 'walk' |'jump';

export interface SpriteAnimationConfig {
    [state: string]: {
        row: number;
        frames: number;
    };
}

export class SpriteAnimator {
    private image: HTMLImageElement;
    private frameWidth: number;
    private frameHeight: number;

    private config: SpriteAnimationConfig;
    private currentState: AnimationState = "idle";
    private currentFrame = 0;
    private frameTimer = 0;
    private frameInterval = 50;

    constructor(
        imageSrc: string,
        frameWidth: number,
        frameHeight: number,
        config: SpriteAnimationConfig,
        frameInterval = 100
    ) {
        this.image = new Image();
        this.image.src = imageSrc;

        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.config = config;
        this.frameInterval = frameInterval;
    }

    setState(state: AnimationState) {
        if (this.currentState !== state) {
            this.currentState = state;
            this.currentFrame = 0;
            this.frameTimer = 0;
        }
    }

    update(dt: number) {
        this.frameTimer += dt;
        const animation = this.config[this.currentState];
        if (this.frameTimer >= this.frameInterval) {
            this.currentFrame = (this.currentFrame + 1) % animation.frames;
            this.frameTimer = 0;
        }
    }

    draw(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        width: number,
        height: number,
        flipped = false
    ) {
        if (!this.image.complete || this.image.naturalWidth === 0) return;

        const { row } = this.config[this.currentState];
        const sx = this.currentFrame * this.frameWidth;
        const sy = row * this.frameHeight;

        ctx.save();

        if (flipped) {
            ctx.translate(x + width / 2, y + height / 2);
            ctx.scale(-1, 1);
            ctx.translate(-width / 2, -height / 2);
            ctx.drawImage(
                this.image,
                sx, sy,
                this.frameWidth, this.frameHeight,
                0, 0,
                width, height
            );
        } else {
            ctx.drawImage(
                this.image,
                sx, sy,
                this.frameWidth, this.frameHeight,
                x, y,
                width, height
            );
        }

        ctx.restore();
    }
}