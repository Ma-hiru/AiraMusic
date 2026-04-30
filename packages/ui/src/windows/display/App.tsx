import { FC } from "react";
import { RouterProvider } from "react-router-dom";
import { DisplayRouter } from "@mahiru/ui/windows/display/router";

const App: FC = () => {
  return <RouterProvider router={DisplayRouter} />;
};

export default App;
