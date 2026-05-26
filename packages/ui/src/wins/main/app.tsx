import "@/styles/index.scss";
import "@/styles/main.scss";
import { RouterProvider } from "react-router-dom";
import { MainRouter } from "@/wins/main/router";

export default function App() {
  return <RouterProvider router={MainRouter} />;
}
