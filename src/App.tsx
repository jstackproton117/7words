import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Home } from "./pages/Home";
import { Create } from "./pages/Create";
import { Join } from "./pages/Join";
import { Lobby } from "./pages/Lobby";
import { Play } from "./pages/Play";
import { Reveal } from "./pages/Reveal";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<Create />} />
        <Route path="/join" element={<Join />} />
        <Route path="/join/:code" element={<Join />} />
        <Route path="/game/:code/lobby" element={<Lobby />} />
        <Route path="/game/:code/play" element={<Play />} />
        <Route path="/game/:code/reveal" element={<Reveal />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
