import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import CommentsPage from "./page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<CommentsPage />);
