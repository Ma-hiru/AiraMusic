import App from "./app";
import wasm from "@mahiru/wasm";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AppEntry from "@mahiru/ui/windows/main/entry";
import Init from "@mahiru/ui/common/utils/init";

wasm().then(() => {
  Init.initSync(AppEntry, {
    panic: true,
    panicMessage: "程序崩溃了"
  });
  const element = document.getElementById("root")!;
  const root = createRoot(element);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
