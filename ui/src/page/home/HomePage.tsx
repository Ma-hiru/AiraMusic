import { FC, memo } from "react";
import { addMessageHandler, removeMessageHandler } from "@mahiru/ui/utils/registerMessageHandlers";
import { login } from "@mahiru/ui/utils/login";
import { doLogout, isAccountLoggedIn } from "@mahiru/ui/api/utils/auth";

const HomePage: FC<object> = () => {
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
                login(message.data);
                removeMessageHandler("login");
              }
            }, "login");
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
