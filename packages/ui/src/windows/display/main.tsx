import "@mahiru/ui/styles/index.scss";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import App from "./App";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
