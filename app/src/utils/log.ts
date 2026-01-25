import { createLog, LogLevelFromString } from "@mahiru/log";

export const Log = createLog(LogLevelFromString(process.env.APP_LOG_LEVEL));
