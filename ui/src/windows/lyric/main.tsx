import "@mahiru/ui/styles/index.scss";
import { createRoot } from "react-dom/client";
import LyricPage from "./page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<LyricPage />);
