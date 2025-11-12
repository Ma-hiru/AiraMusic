import { createBrowserRouter } from "react-router-dom";
import Test from "@mahiru/ui/page/test/Test";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Test />
  }
]);
