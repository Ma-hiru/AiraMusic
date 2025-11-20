import { doLogout, isAccountLoggedIn } from "@mahiru/ui/api/utils/auth";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/registerMessageHandlers";
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
      doLogout();
      window.node.event.createLoginWindow();
      addMessageHandler((message) => {
        if (message.from === "login" && message.type === "login") {
          refreshLogin(message.data).finally(() => removeMessageHandler("login"));
        }
      }, "login");
      navigate("/home");
    }
  }, [navigate, clearPlayList]);
}

export function useLogin() {
  return useCallback(() => {
    if (!isAccountLoggedIn()) {
      window.node.event.createLoginWindow();
      addMessageHandler((message) => {
        if (message.from === "login" && message.type === "login") {
          refreshLogin(message.data).finally(() => removeMessageHandler("login"));
        }
      }, "login");
    }
  }, []);
}
