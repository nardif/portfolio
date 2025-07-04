"use client";

import React from "react";

export const PLATFORM_Y_2 = 1920;

export default function Scene2() {
  return (
    <div
      style={{
        position: "relative",
        height: "100vh",
        background: "linear-gradient(#2a5298, #4e4376)",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
      }}
    >
      <div
      className="platform2"
        style={{
          width: "800px",
          height: "20px",
          backgroundColor: "#333",
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