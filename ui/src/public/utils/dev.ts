import { createEqError, createLog } from "@mahiru/log";
import { ProcessLogger } from "@mahiru/ui/public/utils/logger";

export const isDev = import.meta.env.DEV;
export const isRelease = import.meta.env.PROD;
export const EqError = createEqError(isDev);
export const Log = createLog(
  import.meta.env.UI_LOG_LEVEL,
  isDev ? console : new ProcessLogger(),
  true
);

isDev && Log.info("environment", import.meta.env);
