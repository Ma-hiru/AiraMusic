import { createLog, type LoggerWriter } from "@mahiru/log";
import { initAsync } from "@/common/utils/init";
import { RendererIPC } from "./ipc";

let write: Nullable<
  NormalFunc<
    [
      props: {
        level: "info" | "warn" | "error" | "trace" | "debug";
        message: string;
      }
    ]
  >
> = null;

export class ProcessLogger implements LoggerWriter {
  log(input: string) {
    write?.({ level: "info", message: input });
  }

  warn(input: string) {
    write?.({ level: "warn", message: input });
  }

  error(input: string) {
    write?.({ level: "error", message: input });
  }

  trace(input: string) {
    write?.({ level: "trace", message: input });
  }

  debug(input: string) {
    write?.({ level: "debug", message: input });
  }

  static _init() {
    write = ({ message, level }) => {
      RendererIPC.Event("log", { level, message });
    };
  }
}

export const Log = createLog(
  import.meta.env.UI_LOG_LEVEL,
  import.meta.env.DEV ? console : new ProcessLogger(),
  true
);

import.meta.env.DEV && Log.info("environment", import.meta.env);

import.meta.env.DEV && initAsync(ProcessLogger);
