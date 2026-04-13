import "@mahiru/ui/styles/index.scss";
import { RouterProvider } from "react-router-dom";
import { router } from "@mahiru/ui/windows/main/router";

export default function App() {
  return <RouterProvider router={router} />;
}
