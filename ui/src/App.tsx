import { StrictMode } from "react";
import { RouterProvider } from "react-router-dom";
import router from "@mahiru/ui/router";
import SettingsProvider from "@mahiru/ui/ctx/SettingsProvider";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";
import LayoutProvider from "@mahiru/ui/ctx/LayoutProvider";

export default function App() {
  return (
    <StrictMode>
      <SettingsProvider>
        <PlayerProvider>
          <LayoutProvider>
            <RouterProvider router={router} />
          </LayoutProvider>
        </PlayerProvider>
      </SettingsProvider>
    </StrictMode>
  );
}
