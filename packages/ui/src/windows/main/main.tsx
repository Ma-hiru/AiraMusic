import App from "./App";
import wasm from "@mahiru/wasm";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppEntry from "@mahiru/ui/windows/main/entry";

wasm().then(() => {
  AppEntry.init();
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
