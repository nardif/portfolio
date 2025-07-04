"use client";
import { useEffect, useRef } from "react";
import { GameManager } from "../core/GameManager";

export default function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const managerRef = useRef<GameManager | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const manager = new GameManager(canvas);
    managerRef.current = manager;

    manager.start();

    return () => {
      manager.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} width={800} height={600} />;
}
