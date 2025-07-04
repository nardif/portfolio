"use client";

import React from "react";
import PlayerSprite from "./oPlayerSprite";
import Scene1 from "./o scenes/Scene1";
import Scene2 from "./o scenes/Scene2";
import usePlayerPhysics from "../o hooks/usePlayerPhysics";

export default function GameEngine() {
  const { x, y } = usePlayerPhysics();

  return (
    <div
      className="viewport"
      style={{ overflowY: "auto", height: "100vh", position: "relative" }}
    >
      <div
        className="world"
        style={{ position: "relative", minHeight: "200vh", width: "100%" }}
      >
        <Scene1 />
        <Scene2 />
        <PlayerSprite x={x} y={y} />
      </div>
    </div>
  );
}
