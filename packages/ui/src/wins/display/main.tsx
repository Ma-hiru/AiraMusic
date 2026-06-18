import "@/styles/index.scss";
import "@/styles/display.scss";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { ipcInit } from "@/common/lib/ipc";
import wasm from "@mahiru/wasm";
import App from "./app";

wasm().then(() => {
  ipcInit();
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
