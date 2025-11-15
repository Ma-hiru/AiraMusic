import { createEqError } from "@mahiru/log";
import { isDev } from "@mahiru/ui/utils/dev";

export const EqError = createEqError(isDev);
