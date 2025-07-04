/*"use client";

import GameEngine from "./game/GameEngine";

export default function Home() {
  return <GameEngine />;
}*/

// app/game/page.tsx
"use client";
import dynamic from "next/dynamic";

const Canvas = dynamic(() => import("./game/components/Canvas"), { ssr: false });

export default function GamePage() {
  return (
    <div className="flex justify-center items-center h-screen bg-black">
      <Canvas />
    </div>
  );
}

