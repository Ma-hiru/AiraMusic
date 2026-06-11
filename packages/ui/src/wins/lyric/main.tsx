import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import LyricPage from "./page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(
  <StrictMode>
    <LyricPage />
  </StrictMode>
);
