import App from "./app";
import wasm from "@mahiru/wasm";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initSync } from "@/common/utils/init";
import AppEntry from "@/wins/main/entry";

wasm().then(() => {
  initSync(AppEntry);
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
