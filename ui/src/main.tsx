import { createRoot } from "react-dom/client";
import { registerMessageHandlers } from "@mahiru/ui/utils/registerMessageHandlers";
import "./styles/index.scss";
import App from "./App";

registerMessageHandlers();
const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
