import { StrictMode } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "@mahiru/ui/router";
import SettingsProvider from "@mahiru/ui/ctx/SettingsProvider";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";

export default function App() {
  return (
    <StrictMode>
      <SettingsProvider>
        <PlayerProvider>
          <RouterProvider router={router} />
        </PlayerProvider>
      </SettingsProvider>
    </StrictMode>
  );
}
