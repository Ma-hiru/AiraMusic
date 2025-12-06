import "./styles/index.scss";
import wasm from "@mahiru/wasm";
import { createRoot } from "react-dom/client";
import App from "@mahiru/ui/App_Info";
import { message } from "@mahiru/ui/utils/message";

await wasm();
message();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
