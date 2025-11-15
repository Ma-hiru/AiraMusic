import { createLog, LogLevel } from "@mahiru/log";
import { isDev } from "@mahiru/ui/utils/dev";

export const Log = createLog(isDev ? LogLevel.TRACE : LogLevel.ERROR);
