// A tiny wrapper that mounts the R3F Canvas with your Experience.
// You can drop this anywhere (mobile top-half, desktop full-screen, etc.)

import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Experience } from "./Experience";

export default function AvatarStage({ className = "", ...rest }) {
  return (
    <div className={className} {...rest}>
      <Canvas shadows camera={{ position: [0, 2.2, 5], fov: 30 }}>
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
    </div>
  );
}
