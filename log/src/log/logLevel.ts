export const enum LogLevel {
  TRACE = 0,
  DEBUG,
  INFO,
  WARN,
  ERROR,
  NONE
}

export function LogLevelToString(level: LogLevel) {
  switch (level) {
    case LogLevel.TRACE:
      return "TRACE";
    case LogLevel.DEBUG:
      return "DEBUG";
    case LogLevel.INFO:
      return "INFOS";
    case LogLevel.WARN:
      return "WARNS";
    case LogLevel.ERROR:
      return "ERROR";
    default:
      return "UNKNOWN";
  }
}

export function LogLevelFromString(
  env?: "DEBUG" | "ERROR" | "INFO" | "NONE" | "TRACE" | "WARN" | string
): LogLevel {
  switch (env?.toUpperCase()) {
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
