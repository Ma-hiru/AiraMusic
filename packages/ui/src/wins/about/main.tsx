import "@/styles/index.scss";

import { createRoot } from "react-dom/client";
import { ipcInit } from "@/common/lib/ipc";

import { About } from "./app";

ipcInit();

const element = document.getElementById("root")!;
const root = createRoot(element);
root.render(<About />);
