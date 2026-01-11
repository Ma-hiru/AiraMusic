import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { Auth } from "@mahiru/ui/public/entry/auth";
import { getPlayerStoreSnapshot } from "@mahiru/ui/main/store/player";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

export function useLogout() {
  const navigate = useNavigate();
  return useCallback(() => {
    if (Auth.isAccountLoggedIn()) {
      const { PlayerCoreGetter } = getPlayerStoreSnapshot();
      const player = PlayerCoreGetter();
      player.clearPlaylist();
      Auth.doLogout().finally(() => {
        waitLogin();
        navigate("/home");
      });
    }
  }, [navigate]);
}

export function useLogin() {
  return useCallback(() => {
    !Auth.isAccountLoggedIn() && waitLogin();
  }, []);
}

export function waitLogin() {
  Renderer.invoke.hasOpenInternalWindow("login").then((ok) => {
    if (!ok) {
      Renderer.event.openInternalWindow("login");
    }
    Renderer.removeMessageHandler("loginHandler");
    Renderer.addMessageHandler(
      "login",
      "login",
      (cookie) => {
        Auth.doLogin(cookie);
        Renderer.event.closeInternalWindow("login");
      },
      {
        id: "loginHandler",
        once: true
      }
    );
  });
}
