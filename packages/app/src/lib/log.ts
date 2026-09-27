import { join } from "node:path";
import { mkdirSync, createWriteStream } from "node:fs";
import { getArgValue } from "@/utils/args";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import {
  Colors,
  LogLevel,
  colorText,
  createLog,
  ParseLogLevel,
  type LoggerWriter,
  type Log as LogInstance
} from "@mahiru/log";

import { createCtxRunning } from "./async_store";

const level = ParseLogLevel(getArgValue("log-level") || process.env.APP_LOG_LEVEL);

const raw_console = globalThis.console;

class ContextLoggerWriter implements LoggerWriter {
  constructor(private readonly writer: LoggerWriter) {}

  private format(input: string) {
    const context = LogAsyncStorage.getStore();
    if (!context?.traceId) return input;
    if (Array.isArray(context.traceId))
      return `${input} [${colorText(Colors.red, context.traceId.join(":"))}]`;
    return `${input} [${colorText(Colors.red, context.traceId)}]`;
  }

  log(input: string) {
    this.writer.log(this.format(input));
  }

  warn(input: string) {
    this.writer.warn(this.format(input));
  }

  error(input: string) {
    this.writer.error(this.format(input));
  }

  trace(input: string) {
    this.writer.trace(this.format(input));
  }

  debug(input: string) {
    this.writer.debug(this.format(input));
  }
}

class LoggerFileWriter implements LoggerWriter {
  now;
  dir;
  fileName;
  path;
  stream;

  constructor() {
    this.now = new Date();
    this.dir = MainPathResolver.logDir;
    this.fileName = `${this.now.getFullYear()}-${(this.now.getMonth() + 1).toString().padStart(2, "0")}-${this.now
      .getDate()
      .toString()
      .padStart(2, "0")}_${this.now.getHours().toString().padStart(2, "0")}-${this.now
      .getMinutes()
      .toString()
      .padStart(2, "0")}-${this.now.getSeconds().toString().padStart(2, "0")}.log`;

    mkdirSync(this.dir, { recursive: true });

    this.path = join(this.dir, this.fileName);
    this.stream = createWriteStream(this.path, { flags: "a", encoding: "utf8" });

    process.on("beforeExit", () => {
      this.stream.end();
      this.stream.close();
    });
  }

  write(input: string) {
    this.stream.write(input + "\n");
  }

  log(input: string) {
    this.write(input);
  }

  warn(input: string) {
    this.write(input);
  }

  error(input: string) {
    this.write(input);
  }

  trace(input: string) {
    this.write(input);
  }

  debug(input: string) {
    this.write(input);
  }
}

type LogCtx = {
  traceId: string | string[];
};

export const { AsyncStorage: LogAsyncStorage, runWithContext: runWithLogContext } =
  createCtxRunning<LogCtx>(
    {
      traceId: "unknown"
    },
    (ctx, defaultCtx, parentCtx) => {
      const final: string[] = [];
      const add_ctx = (ctx: Optional<Partial<LogCtx>>) => {
        ctx?.traceId && final.push(...(Array.isArray(ctx.traceId) ? ctx.traceId : [ctx.traceId]));
        return !!ctx?.traceId;
      };

      add_ctx(parentCtx);
      add_ctx(ctx) || add_ctx(defaultCtx);

      return {
        traceId: final.length === 1 ? final[0] : final
      };
    }
  );

export type ExtendLog = LogInstance & {
  EnvLevel: LogLevel;
};

export const Log = <ExtendLog>(
  createLog(
    level,
    new ContextLoggerWriter(MainRuntime.isDev ? raw_console : new LoggerFileWriter()),
    true
  )
);

export function replaceGlobalConsole() {
  const consoleLogger = {
    trace: Log.trace.bind(Log),
    debug: Log.debug.bind(Log),
    info: Log.info.bind(Log),
    warn: Log.warn.bind(Log),
    error: Log.error.bind(Log)
  };
  globalThis.console = new Proxy(raw_console, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && Object.hasOwn(consoleLogger, prop)) {
        return consoleLogger[prop as keyof typeof consoleLogger];
      }
      return Reflect.get(target, prop, receiver);
    }
  });
}

export function restoreGlobalConsole() {
  globalThis.console = raw_console;
}

replaceGlobalConsole();
Log.EnvLevel = level;
