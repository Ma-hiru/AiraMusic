import AppRenderer from "@mahiru/ui/public/entry/renderer";
import { createEqError, createLog } from "@mahiru/log";
import { ProcessLogger } from "@mahiru/ui/public/utils/logger";

let _currentWindowType: Nullable<WindowType> = null;

export const currentWindowType = _currentWindowType!;
export const AppScheme = import.meta.env.APP_SCHEME;
export const AppProtocol = import.meta.env.APP_PROTOCOL;
export const isDev = import.meta.env.DEV;
export const isRelease = import.meta.env.PROD;
export const EqError = createEqError(isDev);
export const Log = createLog(
  import.meta.env.UI_LOG_LEVEL,
  isDev ? console : new ProcessLogger(),
  true
);

window.requestAnimationFrame(async () => {
  _currentWindowType = await AppRenderer.Event.invoke.currentWindowType();
});

isDev && Log.info("environment", import.meta.env);
