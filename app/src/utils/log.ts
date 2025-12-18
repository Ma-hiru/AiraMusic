import { createLog, LogLevel } from "@mahiru/log";

export const convertToLogLevel = (env?: EnvLogLevel): LogLevel => {
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

export const Log = createLog(convertToLogLevel(process.env.APP_LOG_LEVEL as EnvLogLevel));
