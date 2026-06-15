import { createLog, type LoggerWriter } from "@mahiru/log";
import { RendererIPC } from "./ipc";

export class ProcessLogger implements LoggerWriter {
  static write: Nullable<
    NormalFunc<
      [
        props: {
          level: "info" | "warn" | "error" | "trace" | "debug";
          message: string;
        }
      ]
    >
  > = null;

  static {
    if (import.meta.env.PROD) {
      queueMicrotask(() => {
        ProcessLogger.write = (payload) => RendererIPC.Event("log", payload);
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
