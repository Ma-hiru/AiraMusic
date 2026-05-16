import { createLog } from "@mahiru/log";
import { ProcessLogger } from "../utils/logger";

export const isDev = import.meta.env.DEV;
export const isRelease = import.meta.env.PROD;
export const isTest = String(import.meta.env.APP_TEST) === "true";
export const Log = createLog(
  import.meta.env.UI_LOG_LEVEL,
  isDev ? console : new ProcessLogger(),
  true
);

isDev && Log.info("environment", import.meta.env);
