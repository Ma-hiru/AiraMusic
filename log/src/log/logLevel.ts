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
