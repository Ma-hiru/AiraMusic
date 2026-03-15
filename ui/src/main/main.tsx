import { createRoot } from "react-dom/client";
import App from "./App";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<App />);
