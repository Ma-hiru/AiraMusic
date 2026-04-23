import { EqError, EqErrorProps } from "../err";
import { LogLevel, LogLevelToString, ParseLogLevel } from "./logLevel";
import { AnyToString, CanString } from "../string";
import { LoggerWriter } from "./writer";

export interface Log {
  currentLevel: LogLevel;
  format: LogHandler;
  trace: LogHandler;
  debug: LogHandler;
  info: LogHandler;
  warn: LogHandler;
  error: ErrorLogHandler;
  throw: ErrorLogHandler;
}

export interface LogHandler {
  (message: CanString): string;
  (label: CanString, ...messages: CanString[]): string;
}

export interface ErrorLogHandler {
  (error: EqErrorProps): string;
  (message: CanString): string;
  (label: CanString, ...messages: CanString[]): string;
}

export function createLog(
  level: LogLevel | string,
  witter: LoggerWriter = console,
  showTimestamp = false
): Log {
  const currentLevel = ParseLogLevel(level);
  return class {
    static readonly currentLevel = currentLevel;

    private static handleInput(level: LogLevel, ...args: CanString[] | [EqErrorProps]): string {
      if (args.length === 1 && EqError.isErrorProps(args[0]))
        return handleLogInput(level, showTimestamp, new EqError(args[0]));
      const output = handleLogInput(level, showTimestamp, ...args);
      if (this.currentLevel <= level) witter.log(output);
      return output;
    }

    static format(...args: CanString[]) {
      return handleLogInput(undefined, false, ...args);
    }

    static trace(...args: CanString[]) {
      return this.handleInput(LogLevel.TRACE, ...args);
    }

    static debug(...args: CanString[]) {
      return this.handleInput(LogLevel.DEBUG, ...args);
    }

    static info(...args: CanString[]) {
      return this.handleInput(LogLevel.INFO, ...args);
    }

    static warn(...args: CanString[]) {
      return this.handleInput(LogLevel.WARN, ...args);
    }

    static error(...args: CanString[] | [EqErrorProps]) {
      return this.handleInput(LogLevel.ERROR, ...args);
    }

    static throw(...args: CanString[] | [EqErrorProps]): string {
      this.error(...args);
      throw new EqError(handleLogInput(LogLevel.ERROR, showTimestamp, ...args));
    }
  };
}

function handleLogInput(loglevel?: LogLevel, showTimestamp?: boolean, ...messages: CanString[]) {
  let label = undefined;
  if (messages.length === 1) {
    [label, messages] = [undefined, [messages[0]]];
  } else if (messages.length > 1) {
    [label, messages] = [AnyToString(messages[0]), messages.slice(1)];
  }
  return handleLogText(label, messages, loglevel, showTimestamp);
}

function handleLogText(
  label?: string,
  messages: CanString[] = [],
  level?: LogLevel,
  showTimestamp?: boolean
) {
  let text = `${messages.map(AnyToString).join(" ")}`;
  if (label !== undefined) text = `[${label}] ${text}`;
  if (level !== undefined) text = `(${LogLevelToString(level)}) ${text}`;
  if (showTimestamp) text = `${new Date().toLocaleString()} ${text}`;
  return text;
}
