import "./styles/index.scss";
import wasm from "@mahiru/wasm";
import { createRoot } from "react-dom/client";
import App from "@mahiru/ui/App_Info";

await wasm();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
