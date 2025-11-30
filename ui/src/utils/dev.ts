import { createEqError } from "@mahiru/log";
import { createLog, LogLevel } from "@mahiru/log";

const convertToLogLevel = (env?: EnvLogLevel): LogLevel => {
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
};

export const isDev = import.meta.env.DEV;
export const isRelease = import.meta.env.PROD;
export const EqError = createEqError(isDev);
export const Log = createLog(convertToLogLevel(import.meta.env.UI_LOG_LEVEL));
