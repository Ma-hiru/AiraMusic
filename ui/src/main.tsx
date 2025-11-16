import { createRoot } from "react-dom/client";
import { exposeToWindow } from "@mahiru/ui/utils/exposeToWindow";
import "./styles/index.scss";
import App from "./App";

exposeToWindow();
const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
