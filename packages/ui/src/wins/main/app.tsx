import { RouterProvider } from "react-router-dom";
import { MainRouter } from "@/wins/main/router";

export default function App() {
  return <RouterProvider router={MainRouter} />;
}
