import { Colors, colorText } from "./color";
import type { LoggerWriter } from "./writer";
import { EqError, type EqErrorProps } from "../err";
import { AnyToString, type CanString } from "../string";
import { LogLevel, ParseLogLevel, LogLevelToString } from "./logLevel";

export interface Log {
  currentLevel: LogLevel;
  readonly info: LogHandler;
  readonly warn: LogHandler;
  readonly debug: LogHandler;
  readonly trace: LogHandler;
  readonly format: LogHandler;
  readonly Colors: typeof Colors;
  readonly error: ErrorLogHandler;
  readonly throw: ErrorLogHandler;
  readonly colorText: typeof colorText;
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
  level: string | LogLevel,
  witter: LoggerWriter = console,
  showTimestamp = false
): Log {
  const currentLevel = ParseLogLevel(level);
  return class {
    static currentLevel = currentLevel;
    static readonly Colors = Colors;
    static readonly colorText = colorText;

    private static handleInput(level: LogLevel, ...args: CanString[] | [EqErrorProps]): string {
      let output: string;
      if (args.length === 1 && EqError.isErrorProps(args[0])) {
        output = handleLogInput(level, showTimestamp, new EqError(args[0]));
      } else {
        output = handleLogInput(level, showTimestamp, ...args);
      }
      if (this.currentLevel <= level) {
        switch (level) {
          case LogLevel.TRACE:
            witter.trace(output);
            break;
          case LogLevel.DEBUG:
            witter.debug(output);
            break;
          case LogLevel.INFO:
            witter.log(output);
            break;
          case LogLevel.WARN:
            witter.warn(output);
            break;
          case LogLevel.ERROR:
            witter.error(output);
            break;
        }
      }
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
  if (label !== undefined) text = `[${colorText(Colors.green, label)}] ${text}`;
  if (level !== undefined) text = `(${colorText(Colors.blue, LogLevelToString(level))}) ${text}`;
  if (showTimestamp) text = `${colorText(Colors.yellow, new Date().toLocaleString())} ${text}`;
  return text;
}
