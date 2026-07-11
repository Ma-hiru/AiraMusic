import { RendererIPC } from "@mahiru/ipc/renderer";
import { createLog, type LoggerWriter } from "@mahiru/log";

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
  import.meta.env.DEV ? console : new ProcessLogger(),
  true
);

import.meta.env.DEV && Log.info("environment", import.meta.env);
