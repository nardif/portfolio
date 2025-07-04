"use client";

import React from "react";

type Props = {
  x: number;
  y: number;
};

export default function PlayerSprite({ x, y }: Props) {
  return (
    <div
      className="sprite"
      style={{
        position: "relative",
        left: 0,
        top: 10,
        transform: `translate(${x}px, ${y}px)`,
        width: "40px",
        height: "40px",
        backgroundColor: "lime",
        borderRadius: "50%",
        border: "2px solid white",
      }}
    />
  );
}