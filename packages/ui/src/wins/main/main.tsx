import App from "./app";
import wasm from "@mahiru/wasm";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

wasm().then(() => {
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
