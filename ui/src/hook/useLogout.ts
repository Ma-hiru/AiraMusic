import { doLogout, isAccountLoggedIn } from "@mahiru/ui/api/utils/auth";
import { addMessageHandler } from "@mahiru/ui/utils/message";
import { refreshLogin } from "@mahiru/ui/utils/task";
import { useNavigate } from "react-router-dom";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useCallback } from "react";

export function useLogout() {
  const navigate = useNavigate();
  const { clearPlayList } = usePlayer();
  return useCallback(() => {
    if (isAccountLoggedIn()) {
      clearPlayList();
      doLogout().finally(() => {
        waitLogin();
        navigate("/home");
      });
    }
  }, [navigate, clearPlayList]);
}

export function useLogin() {
  return useCallback(() => {
    !isAccountLoggedIn() && waitLogin();
  }, []);
}

function waitLogin() {
  window.electron.event.openInternalWindow("login");
  const unsubscribe = addMessageHandler("login", "login", refreshLogin, {
    once: true,
    id: "wait_login"
  });
  addMessageHandler("otherWindowClosed", "login", unsubscribe, {
    once: true,
    id: "wait_login_close"
  });
}
