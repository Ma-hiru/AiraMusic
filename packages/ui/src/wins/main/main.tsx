import App from "./app";
import wasm from "@mahiru/wasm";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { initSync } from "@/common/utils/init";
import RendererPlayerHandle from "@/wins/main/lib/handle";

wasm().then(() => {
  initSync(RendererPlayerHandle);
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
