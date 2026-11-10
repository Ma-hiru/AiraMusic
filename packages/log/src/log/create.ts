import { AnyToString } from "../string";
import { Colors, colorText } from "./color";
import type { LoggerWriter } from "./writer";
import { EqError, type EqErrorProps } from "../err";
import { JSONFlat, JSONCompact } from "../string/stringify";
import { LogLevel, ParseLogLevel, LogLevelToString } from "./logLevel";

const globalConsole = globalThis as typeof globalThis & { raw_console?: Console };

export interface Log {
  currentLevel: LogLevel;
  readonly info: LogHandler;
  readonly warn: LogHandler;
  readonly debug: LogHandler;
  readonly Pick: typeof pick;
  readonly trace: LogHandler;
  readonly format: LogHandler;
  readonly once: OnceLogHandler;
  readonly Colors: typeof Colors;
  readonly error: ErrorLogHandler;
  readonly throw: ErrorLogHandler;
  readonly Exclude: typeof exclude;
  readonly ColorText: typeof colorText;
  readonly RestoreGlobalConsole: () => void;
  readonly ReplaceGlobalConsole: () => Console;
  readonly JsonFlat: <T extends object>(obj: T) => T & { [JSONFlat]: true };
  readonly JsonCompact: <T extends object>(obj: T) => T & { [JSONCompact]: true };
}

export interface LogHandler {
  (message: unknown): string;
  (label: unknown, ...messages: unknown[]): string;
}

export interface OnceLogHandler {
  (id: number | string, message: unknown): string;
  (id: number | string, label: unknown, ...messages: unknown[]): string;
}

export interface ErrorLogHandler {
  (error: EqErrorProps): string;
  (message: unknown): string;
  (label: unknown, ...messages: unknown[]): string;
}

export function createLog(
  level: string | LogLevel,
  _writer: LoggerWriter = globalConsole.raw_console ?? console,
  showTimestamp = false
): Log {
  const currentLevel = ParseLogLevel(level);
  // 保留输出方法与接收者，console 被临时替换时也不回到日志自身。
  const writer: LoggerWriter = {
    log: _writer.log.bind(_writer),
    warn: _writer.warn.bind(_writer),
    debug: _writer.debug.bind(_writer),
    error: _writer.error.bind(_writer),
    trace: _writer.trace.bind(_writer)
  };
  return class {
    static currentLevel = currentLevel;
    static readonly Colors = Colors;
    static readonly ColorText = colorText;

    private static output(level: LogLevel, ...args: unknown[] | [EqErrorProps]): string {
      let output: string;
      if (args.length === 1 && EqError.isErrorProps(args[0])) {
        output = normalize(level, showTimestamp, new EqError(args[0]));
      } else {
        output = normalize(level, showTimestamp, ...args);
      }
      if (this.currentLevel <= level) {
        switch (level) {
          case LogLevel.TRACE:
            writer.trace(output);
            break;
          case LogLevel.DEBUG:
            writer.debug(output);
            break;
          case LogLevel.INFO:
            writer.log(output);
            break;
          case LogLevel.WARN:
            writer.warn(output);
            break;
          case LogLevel.ERROR:
            writer.error(output);
            break;
        }
      }
      return output;
    }

    static format(...args: unknown[]) {
      return normalize(undefined, false, ...args);
    }

    static trace(...args: unknown[]) {
      return this.output(LogLevel.TRACE, ...args);
    }

    static debug(...args: unknown[]) {
      return this.output(LogLevel.DEBUG, ...args);
    }

    static info(...args: unknown[]) {
      return this.output(LogLevel.INFO, ...args);
    }

    static warn(...args: unknown[]) {
      return this.output(LogLevel.WARN, ...args);
    }

    static error(...args: unknown[] | [EqErrorProps]) {
      return this.output(LogLevel.ERROR, ...args);
    }

    static once_record = new Set<number | string>();
    static once(id: number | string, ...args: unknown[]) {
      if (this.once_record.has(id)) return "";
      this.once_record.add(id);
      return this.error(...args);
    }

    static JsonCompact<T extends object>(obj: T): T & { [JSONCompact]: true } {
      // @ts-expect-error
      if (obj != null && typeof obj === "object") obj[JSONCompact] = true;
      return obj as T & { [JSONCompact]: true };
    }

    static JsonFlat<T extends object>(obj: T): T & { [JSONFlat]: true } {
      // @ts-expect-error
      if (obj != null && typeof obj === "object") obj[JSONFlat] = true;
      return obj as T & { [JSONFlat]: true };
    }

    static Pick = pick;

    static Exclude = exclude;

    static throw(...args: unknown[] | [EqErrorProps]): string {
      this.error(...args);
      throw new EqError(normalize(LogLevel.ERROR, showTimestamp, ...args));
    }

    static ReplaceGlobalConsole(): Console {
      if (globalConsole.raw_console) return globalConsole.raw_console;
      const rawConsole = globalConsole.console;
      globalConsole.raw_console = rawConsole;
      // React 会通过 defineProperties 静音/恢复 console；独立对象避免写穿原始输出端。
      const consoleLogger: Console = Object.create(
        Object.getPrototypeOf(rawConsole),
        Object.getOwnPropertyDescriptors(rawConsole)
      );
      Object.assign(consoleLogger, {
        trace: this.trace.bind(this),
        debug: this.debug.bind(this),
        info: this.info.bind(this),
        warn: this.warn.bind(this),
        error: this.error.bind(this)
      });
      globalConsole.console = consoleLogger;
      return rawConsole;
    }

    static RestoreGlobalConsole() {
      if (!globalConsole.raw_console) return;
      globalConsole.console = globalConsole.raw_console;
      globalConsole.raw_console = undefined;
    }
  };
}

const normalize = (
  loglevel?: LogLevel,
  showTimestamp?: boolean,
  ...messages: unknown[]
): string => {
  let label = undefined;
  if (messages.length === 1) {
    [label, messages] = [undefined, [messages[0]]];
  } else if (messages.length > 1) {
    [label, messages] = [AnyToString(messages[0]), messages.slice(1)];
  }
  return format(label, messages, loglevel, showTimestamp);
};

const format = (
  label?: string,
  messages: unknown[] = [],
  level?: LogLevel,
  showTimestamp?: boolean
): string => {
  let text = `${messages.map(AnyToString).join(" ")}`;
  if (label !== undefined) text = `[${colorText(Colors.green, label)}] ${text}`;
  if (level !== undefined) text = `(${colorText(Colors.blue, LogLevelToString(level))}) ${text}`;
  if (showTimestamp) text = `${colorText(Colors.yellow, new Date().toLocaleString())} ${text}`;
  return text;
};

const pick = <const T extends object, const F extends (keyof T)[]>(
  obj: T,
  fields: F
): Pick<T, F[number]> => {
  const res: Record<string, any> = {};
  const f = new Set(fields);
  for (const [key, value] of Object.entries(obj)) f.delete(key as keyof T) && (res[key] = value);
  return res as Pick<T, F[number]>;
};

const exclude = <const T extends object, const F extends (keyof T)[]>(
  obj: T,
  fields: F
): Omit<T, F[number]> => {
  const res: Record<string, any> = {};
  const f = new Set(fields);
  for (const [key, value] of Object.entries(obj)) f.has(key as keyof T) || (res[key] = value);
  return res as Omit<T, F[number]>;
};
