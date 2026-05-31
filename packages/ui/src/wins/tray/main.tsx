import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import TrayPage from "./page/tray-page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<TrayPage />);
