import "@/styles/index.scss";
import "@/styles/main.scss";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
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
