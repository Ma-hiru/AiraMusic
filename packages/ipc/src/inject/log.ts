import { createLog, type Log as LogInstance, LogLevel } from "@mahiru/log";

const DefaultLog = createLog(LogLevel.WARN, console, true);

export let Log = DefaultLog;

export function setLogger(logger: Optional<LogInstance>) {
  if (!logger) {
    Log = DefaultLog;
    return;
  }
  Log = logger;
}
