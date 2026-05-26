import { type FC } from "react";
import { RouterProvider } from "react-router-dom";
import { DisplayRouter } from "../display/router";

const App: FC = () => {
  return <RouterProvider router={DisplayRouter} />;
};

export default App;
