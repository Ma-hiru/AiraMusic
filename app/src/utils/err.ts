import { createEqError } from "@mahiru/log";
import { isDev } from "./dev";

export const EqError = createEqError(isDev);
