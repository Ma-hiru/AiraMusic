import { RouterProvider } from "react-router-dom";
import { router } from "@mahiru/ui/main/router";

export default function App() {
  return <RouterProvider router={router} />;
}
