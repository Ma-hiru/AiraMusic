import { Log } from "@mahiru/log";

export let Log: Nullable<Log> = null;

export function setLogger(logger: Log) {
  Log = logger;
}
