import { createRoot } from "react-dom/client";
import { started } from "@mahiru/ui/utils/started";
import { message } from "@mahiru/ui/utils/message";
import wasm from "@mahiru/wasm";
import "./styles/index.scss";
import App from "./App";

await wasm();
message();
started();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
