import { createEqError } from "@mahiru/err";
import { isDev } from "@mahiru/ui/utils/dev";

export const EqError = createEqError(isDev);
