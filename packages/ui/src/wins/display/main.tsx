import "@/styles/index.scss";
import "@/styles/display.scss";
import wasm from "@mahiru/wasm";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./app";

wasm().then(() => {
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
