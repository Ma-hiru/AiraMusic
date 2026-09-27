import { RendererIPC } from "@mahiru/ipc/renderer";
import { createLog, type LoggerWriter } from "@mahiru/log";

window.raw_console = window.console;

export class ProcessLogger implements LoggerWriter {
  static write: Nullable<
    NormalFunc<
      [
        props: {
          message: string;
          level: "info" | "warn" | "debug" | "error" | "trace";
        }
      ]
    >
  > = null;

  static {
    if (import.meta.env.PROD) {
      queueMicrotask(() => {
        ProcessLogger.write = (payload) =>
          RendererIPC.NormalChannel.send("event_debug_log", payload);
      });
    }
  }

  log(input: string) {
    ProcessLogger.write?.({ level: "info", message: input });
  }

  warn(input: string) {
    ProcessLogger.write?.({ level: "warn", message: input });
  }

  error(input: string) {
    ProcessLogger.write?.({ level: "error", message: input });
  }

  trace(input: string) {
    ProcessLogger.write?.({ level: "trace", message: input });
  }

  debug(input: string) {
    ProcessLogger.write?.({ level: "debug", message: input });
  }
}

export const Log = createLog(
  import.meta.env.UI_LOG_LEVEL,
  import.meta.env.DEV ? window.raw_console : new ProcessLogger(),
  true
);

export function replaceGlobalConsole() {
  const consoleLogger = {
    trace: Log.trace.bind(Log),
    debug: Log.debug.bind(Log),
    info: Log.info.bind(Log),
    warn: Log.warn.bind(Log),
    error: Log.error.bind(Log)
  };
  window.console = new Proxy(window.raw_console, {
    get(target, prop, receiver) {
      if (typeof prop === "string" && Object.hasOwn(consoleLogger, prop))
        return consoleLogger[prop as keyof typeof consoleLogger];
      return Reflect.get(target, prop, receiver);
    }
  });
}

export function restoreGlobalConsole() {
  window.console = window.raw_console;
}

replaceGlobalConsole();
import.meta.env.DEV && Log.info("environment", import.meta.env);
