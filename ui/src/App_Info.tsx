import { FC, memo } from "react";
import { RouterProvider } from "react-router-dom";
import { infoRouter } from "@mahiru/ui/router/info";

const App_Info: FC<object> = () => {
  return <RouterProvider router={infoRouter} />;
};
export default memo(App_Info);
