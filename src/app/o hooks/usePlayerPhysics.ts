"use client";

import { useState, useEffect } from "react";
import { PLATFORM_Y } from "../game/o scenes/Scene1";
import { PLATFORM_Y_2 } from "../game/o scenes/Scene2";

const GRAVITY = 0.6;
const MOVE_SPEED = 5;
const TICK_RATE = 16;
const SPRITE_HEIGHT = 40;
const SPRITE_WIDTH = 40;

export default function usePlayerPhysics() {
  const [y, setY] = useState(0);
  const [x, setX] = useState(0);
  const [velocityY, setVelocityY] = useState(0);
  const [grounded, setGrounded] = useState(true);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setX(window.innerWidth / 2);
      setY(window.innerHeight/2);
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "a") setX((x) => x - MOVE_SPEED);
      if (e.key === "d") setX((x) => x + MOVE_SPEED);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setY((prevY) => {
        let nextVelocity = velocityY + GRAVITY;
        let nextY = prevY + nextVelocity;

        const platformX = window.innerWidth / 2 - 100;
        const platformWidth = 200;

        const isOnPlatform1 =
          x + SPRITE_WIDTH > platformX &&
          x < platformX + platformWidth &&
          nextY + SPRITE_HEIGHT >= PLATFORM_Y &&
          nextY + SPRITE_HEIGHT < PLATFORM_Y_2;

        const isOnPlatform2 =
          x + SPRITE_WIDTH > platformX &&
          x < platformX + platformWidth &&
          nextY + SPRITE_HEIGHT >= PLATFORM_Y_2;

        if (isOnPlatform1) {
          setGrounded(true);
          setVelocityY(0);
          return PLATFORM_Y - SPRITE_HEIGHT;
        }

        if (isOnPlatform2) {
          setGrounded(true);
          setVelocityY(0);
          return PLATFORM_Y_2 - SPRITE_HEIGHT;
        }

        setGrounded(false);
        setVelocityY(nextVelocity);
        return nextY;
      });
    }, TICK_RATE);

    return () => clearInterval(interval);
  }, [velocityY, x]);

  return { x, y, grounded };
}