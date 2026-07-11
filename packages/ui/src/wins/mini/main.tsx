import "@/styles/index.scss";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ipcInit } from "@/common/lib/ipc";

import MiniPlayerPage from "./page/mini-player-page";

ipcInit();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(
  <StrictMode>
    <MiniPlayerPage />
  </StrictMode>
);
