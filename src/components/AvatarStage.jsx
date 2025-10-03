// components/AvatarStage.jsx
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Experience } from "./Experience";

export default function AvatarStage({ className = "", ...rest }) {
  return (
    <div className={`w-full h-full ${className}`} {...rest}>
      <Canvas shadows camera={{ position: [0, 1.8, 6.5], fov: 30 }}>
        <Suspense fallback={null}>
          <Experience />
        </Suspense>
      </Canvas>
    </div>
  );
}
