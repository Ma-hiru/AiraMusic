import { LogLevel, LogLevelToString, ParseLogLevel } from "./logLevel";
import { AnyToString, CanString } from "../string";
import { LoggerWriter } from "./writer";

export interface Log {
  trace: LogHandler;
  debug: LogHandler;
  info: LogHandler;
  warn: LogHandler;
  error: LogHandler;
  throw: LogHandler;
}

export interface LogHandler {
  (message: CanString): void;
  (label: CanString, ...messages: CanString[]): void;
}

export function createLog(
  level: LogLevel | string,
  witter: LoggerWriter = console,
  showTimestamp = false
): Log {
  return class {
    private static readonly level = ParseLogLevel(level);
    static trace(...args: CanString[]) {
      if (this.level <= LogLevel.TRACE) {
        witter.trace(handleLogInput(LogLevel.TRACE, showTimestamp, ...args));
      }
    }
    static debug(...args: CanString[]) {
      if (this.level <= LogLevel.DEBUG) {
        witter.debug(handleLogInput(LogLevel.DEBUG, showTimestamp, ...args));
      }
    }
    static info(...args: CanString[]) {
      if (this.level <= LogLevel.INFO) {
        witter.log(handleLogInput(LogLevel.INFO, showTimestamp, ...args));
      }
    }
    static warn(...args: CanString[]) {
      if (this.level <= LogLevel.WARN) {
        witter.warn(handleLogInput(LogLevel.WARN, showTimestamp, ...args));
      }
    }
    static error(...args: CanString[]) {
      if (this.level <= LogLevel.ERROR) {
        witter.error(handleLogInput(LogLevel.ERROR, showTimestamp, ...args));
      }
    }
    static throw(...args: CanString[]) {
      this.error(...args);
      throw new Error(handleLogInput(LogLevel.ERROR, showTimestamp, ...args));
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
