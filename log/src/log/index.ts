import { Messageable, MessageableToString } from "./message";
import { LogLevel, LogLevelToString } from "./logLevel";

export { LogLevel, LogLevelToString } from "./logLevel";

export interface Log {
  trace: LogHandler;
  debug: LogHandler;
  info: LogHandler;
  warn: LogHandler;
  error: LogHandler;
}

export interface LogHandler {
  //  单个参数
  (message: Messageable): void;
  // 多个参数
  (label: Messageable, ...messages: Messageable[]): void;
}

export function createLog(level: LogLevel, showTimestamp: boolean = false): Log {
  return class {
    private static readonly level = level;
    static trace(...args: Messageable[]) {
      if (this.level <= LogLevel.TRACE) {
        console.trace(handleLogInput(LogLevel.TRACE, showTimestamp, ...args));
      }
    }
    static debug(...args: Messageable[]) {
      if (this.level <= LogLevel.DEBUG) {
        console.debug(handleLogInput(LogLevel.DEBUG, showTimestamp, ...args));
      }
    }
    static info(...args: Messageable[]) {
      if (this.level <= LogLevel.INFO) {
        console.log(handleLogInput(LogLevel.INFO, showTimestamp, ...args));
      }
    }
    static warn(...args: Messageable[]) {
      if (this.level <= LogLevel.WARN) {
        console.warn(handleLogInput(LogLevel.WARN, showTimestamp, ...args));
      }
    }
    static error(...args: Messageable[]) {
      if (this.level <= LogLevel.ERROR) {
        console.error(handleLogInput(LogLevel.ERROR, showTimestamp, ...args));
      }
    }
  };
}

function handleLogInput(
  loglevel: LogLevel,
  showTimestamp: boolean = false,
  ...messages: Messageable[]
) {
  if (messages.length === 1) {
    return handleLogText(undefined, [messages[0]], loglevel, showTimestamp);
  } else if (messages.length > 1) {
    return handleLogText(
      MessageableToString(messages[0]),
      messages.slice(1),
      loglevel,
      showTimestamp
    );
  }
  return "";
}

function handleLogText(
  label: string | undefined,
  message: Messageable[],
  level: LogLevel,
  showTimestamp = false
) {
  if (typeof label === "string") {
    if (showTimestamp) {
      const timestamp = new Date().toISOString();
      return `${timestamp} (${LogLevelToString(level)}) [${label}] ${message.map(MessageableToString).join(" ")}`;
    }
    return `(${LogLevelToString(level)}) [${label}] ${message.map(MessageableToString).join(" ")}`;
  } else {
    if (showTimestamp) {
      const timestamp = new Date().toISOString();
      return `${timestamp} (${LogLevelToString(level)}) ${message.map(MessageableToString).join(" ")}`;
    }
    return `(${LogLevelToString(level)}) ${message.map(MessageableToString).join(" ")}`;
  }
}
