import { Loader } from "@react-three/drei";
import { UI } from "./components/UI";

function App() {
  return (
    <>
      <Loader />

      {/* Full-screen background image */}
      <div className="fixed inset-0 -z-10">
        <img
          src="https://img.freepik.com/premium-photo/blur-background-modern-office-interior-design-contemporary-workspace-creative-business_31965-63877.jpg"
          alt=""
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-white/10" />
      </div>

      {/* UI now mounts the avatar (both mobile + desktop) */}
      <UI />
    </>
  );
}

export default App;
