import "@mahiru/ui/styles/index.scss";
import { createRoot } from "react-dom/client";
import { Task } from "./entry/task";
import wasm from "@mahiru/wasm";
import App from "./App";

wasm();
Task.startTaskOnce();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
