import { Loader } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Experience } from "./components/Experience";
import { UI } from "./components/UI";
// import { Leva } from "leva"; // optional

function App() {
  return (
    <>
      <Loader />

      {/* Full-screen background image behind everything */}
      <div className="fixed inset-0 -z-10">
        <img
          src="https://img.freepik.com/premium-photo/blur-background-modern-office-interior-design-contemporary-workspace-creative-business_31965-63877.jpg"
          alt=""
          className="w-full h-full object-cover"
        />
        {/* subtle wash for legibility (tweak/remove as you like) */}
        <div className="absolute inset-0 bg-white/10" />
      </div>

      {/* <Leva hidden /> */}
      <UI />
      <Canvas shadows camera={{ position: [0, 0, 1], fov: 30 }}>
        <Experience />
      </Canvas>
    </>
  );
}

export default App;
