import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import MiniPlayerPage from "./page/mini-player-page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(
  <StrictMode>
    <MiniPlayerPage />
  </StrictMode>
);
