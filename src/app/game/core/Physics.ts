// core/Physics.ts
import { Player } from "./Player";
import { Platform } from "./Platform";

export function checkCollision(player: Player, platform: Platform): boolean {
  return (
    player.x < platform.x + platform.width &&
    player.x + player.width > platform.x &&
    player.y < platform.y + platform.height &&
    player.y + player.height > platform.y
  );
}

export function resolveCollision(player: Player, platform: Platform) {
  const px = player.x;
  const py = player.y;
  const pw = player.width;
  const ph = player.height;

  const dx = (px + pw / 2) - (platform.x + platform.width / 2);
  const dy = (py + ph / 2) - (platform.y + platform.height / 2);
  const width = (pw + platform.width) / 2;
  const height = (ph + platform.height) / 2;

  const crossWidth = width * dy;
  const crossHeight = height * dx;

  if (Math.abs(dx) <= width && Math.abs(dy) <= height) {
    if (crossWidth > crossHeight) {
      if (crossWidth > -crossHeight) {
        // Bottom Collision
        player.y = platform.y + platform.height;
        player.vy = 0;
      } else {
        // Left Collision
        player.x = platform.x - pw;
        player.vx = 0;
      }
    } else {
      if (crossWidth > -crossHeight) {
        // Right Collision
        player.x = platform.x + platform.width;
        player.vx = 0;
      } else {
        // Top Collision
        player.y = platform.y - ph;
        player.vy = 0;
        player.onGround = true;
      }
    }
  }
}
