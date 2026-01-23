import { createEqError, createLog, LogLevel } from "@mahiru/log";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { nextFrame } from "@mahiru/ui/public/utils/frame";

function convertToLogLevel(env?: EnvLogLevel): LogLevel {
  if (!env) return LogLevel.TRACE;
  switch (env.toUpperCase()) {
    case "TRACE":
      return LogLevel.TRACE;
    case "DEBUG":
      return LogLevel.DEBUG;
    case "INFO":
      return LogLevel.INFO;
    case "WARN":
      return LogLevel.WARN;
    case "ERROR":
      return LogLevel.ERROR;
    case "NONE":
      return LogLevel.NONE;
    default:
      return LogLevel.TRACE;
  }
}

let isMain = false;

export const isMainWindow = () => isMain;
export const AppScheme = import.meta.env.APP_SCHEME;
export const AppProtocol = import.meta.env.APP_PROTOCOL;
export const isDev = import.meta.env.DEV;
export const isRelease = import.meta.env.PROD;
export const EqError = createEqError(isDev);
export const Log = createLog(convertToLogLevel(import.meta.env.UI_LOG_LEVEL as EnvLogLevel));

void nextFrame(() => {
  Renderer.invoke.isMainWindow().then((is) => {
    isMain = is;
  });
});

isDev && Log.info("environment", import.meta.env);
