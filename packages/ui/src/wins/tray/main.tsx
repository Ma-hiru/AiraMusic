import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { ipcInit } from "@/common/lib/ipc";
import TrayPage from "./page/tray-page";

ipcInit();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(
  <StrictMode>
    <TrayPage />
  </StrictMode>
);
