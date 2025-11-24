import { StrictMode } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@mahiru/ui/router";
import SettingsProvider from "@mahiru/ui/ctx/SettingsProvider";

export default function App() {
  return (
    <StrictMode>
      <SettingsProvider>
        <RouterProvider router={router} />
      </SettingsProvider>
    </StrictMode>
  );
}
