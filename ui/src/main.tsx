import { createRoot } from "react-dom/client";
import { started } from "@mahiru/ui/utils/started";
import wasm from "@mahiru/wasm";
import "./styles/index.scss";
import App from "./App";

await wasm();
started();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
