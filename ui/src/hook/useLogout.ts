import { refreshLogin } from "@mahiru/ui/utils/task";
import { useNavigate } from "react-router-dom";
import { useCallback } from "react";
import { Auth } from "@mahiru/ui/utils/auth";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { Player } from "@mahiru/ui/utils/player";

export function useLogout() {
  const navigate = useNavigate();
  return useCallback(() => {
    if (Auth.isAccountLoggedIn()) {
      Player.clearPlaylist();
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
        refreshLogin(cookie).then(() => {
          Renderer.event.closeInternalWindow("login");
        });
      },
      {
        id: "loginHandler",
        once: true
      }
    );
  });
}
