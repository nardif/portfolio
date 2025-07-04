"use client";

import React from "react";

export const PLATFORM_Y = 800; // 100vh (1000px) - 80px (bottom offset)

export default function Scene1() {
  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        background: "linear-gradient(#1e3c72, #2a5298)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
      }}
    >
      <div
        style={{
          width: "500px",
          height: "20px",
          backgroundColor: "#222",
          position: "absolute",
          bottom: "80px",
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: "5px",
        }}
      />
    </div>
  );
}
