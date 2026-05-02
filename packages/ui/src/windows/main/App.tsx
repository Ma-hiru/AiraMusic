import "@mahiru/ui/styles/index.scss";
import "@mahiru/ui/styles/main.scss";
import { RouterProvider } from "react-router-dom";
import { MainRouter } from "@mahiru/ui/windows/main/router";

export default function App() {
  return <RouterProvider router={MainRouter} />;
}
