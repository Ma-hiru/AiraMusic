import { createEqError } from "@mahiru/log";
import { createLog, LogLevel } from "@mahiru/log";

export const isDev = import.meta.env.DEV;
export const isRelease = import.meta.env.PROD;
export const EqError = createEqError(isDev);
export const Log = createLog(isDev ? LogLevel.DEBUG : LogLevel.ERROR);
