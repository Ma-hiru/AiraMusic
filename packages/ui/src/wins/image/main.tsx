import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import ImagePage from "./page/image-page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<ImagePage />);
