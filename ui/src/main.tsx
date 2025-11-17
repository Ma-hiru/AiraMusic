import { createRoot } from "react-dom/client";
import { startedTask } from "@mahiru/ui/utils/startedTask";
import { registerMessageHandlers } from "@mahiru/ui/utils/registerMessageHandlers";
import "./styles/index.scss";
import App from "./App";

registerMessageHandlers();
startedTask();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
