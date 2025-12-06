import SettingsProvider from "@mahiru/ui/ctx/SettingsProvider";
import { FC, memo } from "react";
import { RouterProvider } from "react-router-dom";
import { infoRouter } from "@mahiru/ui/router/info";

const App_Info: FC<object> = () => {
  return (
    <SettingsProvider>
      <RouterProvider router={infoRouter} />
    </SettingsProvider>
  );
};
export default memo(App_Info);
