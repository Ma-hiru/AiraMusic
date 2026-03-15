import "@mahiru/ui/styles/index.scss";
import { RouterProvider } from "react-router-dom";
import { router } from "@mahiru/ui/main/router";
import { useEffect } from "react";

import AppInstance from "@mahiru/ui/main/entry/instance";
import wasm from "@mahiru/wasm";

export default function App() {
  useEffect(() => {
    wasm();
  }, []);

  useEffect(() => {
    AppInstance.init();
  }, []);

  return <RouterProvider router={router} />;
}
