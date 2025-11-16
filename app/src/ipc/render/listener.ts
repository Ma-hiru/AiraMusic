import { typedIpcRenderOn } from "./typed";
import { Log } from "../../utils/log";

export function setupRenderEventListeners() {
  typedIpcRenderOn("loggedInSuccess", (_e, cookies) => {
    Log.trace("loggedInSuccess", cookies);
    if (window && window.login) {
      Log.debug("Logged in successfully, invoking login with cookies.");
      window.login(cookies);
    }
  });
}
