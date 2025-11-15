import { createLog, LogLevel } from "@mahiru/log";
import { isDev } from "./dev";

export const Log = createLog(isDev() ? LogLevel.TRACE : LogLevel.ERROR);
