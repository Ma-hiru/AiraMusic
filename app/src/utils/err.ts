import { createEqError } from "@mahiru/err";
import { isDev } from "./dev";

export const EqError = createEqError(isDev());
