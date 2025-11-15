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

export function createLog(level: LogLevel): Log {
  return class {
    private static readonly level = level;
    static trace(...args: Messageable[]) {
      if (this.level <= LogLevel.TRACE) {
        console.log(handleLogInput(LogLevel.TRACE, ...args));
      }
    }
    static debug(...args: Messageable[]) {
      if (this.level <= LogLevel.DEBUG) {
        console.debug(handleLogInput(LogLevel.DEBUG, ...args));
      }
    }
    static info(...args: Messageable[]) {
      if (this.level <= LogLevel.INFO) {
        console.log(handleLogInput(LogLevel.INFO, ...args));
      }
    }
    static warn(...args: Messageable[]) {
      if (this.level <= LogLevel.WARN) {
        console.warn(handleLogInput(LogLevel.WARN, ...args));
      }
    }
    static error(...args: Messageable[]) {
      if (this.level <= LogLevel.ERROR) {
        console.error(handleLogInput(LogLevel.ERROR, ...args));
      }
    }
  };
}

function handleLogInput(loglevel: LogLevel, ...messages: Messageable[]) {
  if (messages.length === 1) {
    return handleLogText(undefined, [messages[0]], loglevel);
  } else if (messages.length > 1) {
    return handleLogText(MessageableToString(messages[0]), messages.slice(1), loglevel);
  }
  return "";
}

function handleLogText(label: string | undefined, message: Messageable[], level: LogLevel) {
  if (typeof label === "string") {
    return `(${LogLevelToString(level)}) [${label}] ${message.map(MessageableToString).join(" ")}`;
  } else {
    return `(${LogLevelToString(level)}) ${message.map(MessageableToString).join(" ")}`;
  }
}
