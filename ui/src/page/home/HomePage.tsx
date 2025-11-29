import { FC, memo } from "react";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/message";
import { doLogout, isAccountLoggedIn } from "@mahiru/ui/api/utils/auth";
import { refreshLogin } from "@mahiru/ui/utils/task";
import { isDev } from "@mahiru/ui/utils/dev";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";

const HomePage: FC<object> = () => {
  usePlayingBackground();
  return (
    <div className="w-screen h-screen flex  flex-col justify-center items-center text-md font-mono text-white">
      Home Page
      <button
        className="border bg-purple-500 text-white px-2 py-1 rounded-md font-mono"
        onClick={() => {
          if (!isAccountLoggedIn()) {
            window.node.event.createLoginWindow();
            addMessageHandler((message) => {
              if (message.from === "login" && message.type === "login") {
                refreshLogin(message.data);
                removeMessageHandler("login");
              }
            }, "login");
          } else if (isDev) {
            window.node.event.createLoginWindow();
          }
        }}>
        Login
      </button>
      <button
        className="border bg-purple-500 text-white px-2 py-1 rounded-md font-mono"
        onClick={() => {
          if (isAccountLoggedIn()) {
            doLogout();
          }
        }}>
        Logout
      </button>
    </div>
  );
};

export default memo(HomePage);
