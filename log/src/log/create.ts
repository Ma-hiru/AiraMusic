import { LogLevel, LogLevelToString } from "./logLevel";
import { AnyToString, CanString } from "../string";

export interface Log {
  trace: LogHandler;
  debug: LogHandler;
  info: LogHandler;
  warn: LogHandler;
  error: LogHandler;
}

export interface LogHandler {
  (message: CanString): void;
  (label: CanString, ...messages: CanString[]): void;
}

export function createLog(level: LogLevel, showTimestamp: boolean = false): Log {
  return class {
    private static readonly level = level;
    static trace(...args: CanString[]) {
      if (this.level <= LogLevel.TRACE) {
        console.trace(handleLogInput(LogLevel.TRACE, showTimestamp, ...args));
      }
    }
    static debug(...args: CanString[]) {
      if (this.level <= LogLevel.DEBUG) {
        console.debug(handleLogInput(LogLevel.DEBUG, showTimestamp, ...args));
      }
    }
    static info(...args: CanString[]) {
      if (this.level <= LogLevel.INFO) {
        console.log(handleLogInput(LogLevel.INFO, showTimestamp, ...args));
      }
    }
    static warn(...args: CanString[]) {
      if (this.level <= LogLevel.WARN) {
        console.warn(handleLogInput(LogLevel.WARN, showTimestamp, ...args));
      }
    }
    static error(...args: CanString[]) {
      if (this.level <= LogLevel.ERROR) {
        console.error(handleLogInput(LogLevel.ERROR, showTimestamp, ...args));
      }
    }
  };
}

function handleLogInput(
  loglevel: LogLevel,
  showTimestamp: boolean = false,
  ...messages: CanString[]
) {
  if (messages.length === 1) {
    return handleLogText(undefined, [messages[0]], loglevel, showTimestamp);
  } else if (messages.length > 1) {
    return handleLogText(AnyToString(messages[0]), messages.slice(1), loglevel, showTimestamp);
  }
  return "";
}

function handleLogText(
  label: string | undefined,
  message: CanString[],
  level: LogLevel,
  showTimestamp = false
) {
  let text: string;
  if (typeof label === "string") {
    text = `(${LogLevelToString(level)}) [${label}] ${message.map(AnyToString).join(" ")}`;
  } else {
    text = `(${LogLevelToString(level)}) ${message.map(AnyToString).join(" ")}`;
  }
  if (showTimestamp) {
    text = `${new Date().toLocaleString()} ${text}`;
  }
  return text;
}
