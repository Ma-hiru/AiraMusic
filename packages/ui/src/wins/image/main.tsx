import "@/styles/index.scss";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import ImagePage from "./page/image-page";

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(
  <StrictMode>
    <ImagePage />
  </StrictMode>
);
