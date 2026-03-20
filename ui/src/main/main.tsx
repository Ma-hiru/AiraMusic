import App from "./App";
import wasm from "@mahiru/wasm";
import { createRoot } from "react-dom/client";
import AppInstance from "@mahiru/ui/main/entry/instance";

wasm().then(() => {
  AppInstance.init();
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(<App />);
});
