import { createLog, type LoggerWriter } from "@mahiru/log";
import { ensureInitObject, Init, initAsync } from "@/common/utils/init";
import { RendererIPC } from "./ipc";

@Init(() => {
  ProcessLogger.write = ({ message, level }) => {
    RendererIPC.Event("log", { level, message });
  };
})
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

import.meta.env.DEV && initAsync(ensureInitObject(ProcessLogger));
