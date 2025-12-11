import { refreshLogin } from "@mahiru/ui/utils/task";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useCallback } from "react";
import { Auth } from "@mahiru/ui/utils/auth";
import { Renderer } from "@mahiru/ui/utils/renderer";

export function useLogout() {
  const navigate = useNavigate();
  const { playlistControl } = usePlayer();
  return useCallback(() => {
    if (Auth.isAccountLoggedIn()) {
      playlistControl.clearPlaylist();
      Auth.doLogout().finally(() => {
        waitLogin();
        navigate("/home");
      });
    }
  }, [navigate, playlistControl]);
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
      const unsubscribe = Renderer.addMessageHandler("login", "login", refreshLogin, {
        once: true
      });
      Renderer.addMessageHandler("otherWindowClosed", "login", unsubscribe, { once: true });
    }
  });
}
