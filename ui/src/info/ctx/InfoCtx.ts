import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/public/utils/dev";

export const defaultInfoCtxValue = {
  type: "none",
  value: 0
} as InfoSync<any>;

export const InfoCtx = createContext<InfoSync<any>>(defaultInfoCtxValue);

export function useInfoCtx<T extends InfoSyncType>() {
  const infoCtxValue = useContext(InfoCtx);
  if (!infoCtxValue) {
    throw new EqError({
      message: "useInfoCtx must be used within a InfoLayout",
      label: "InfoCtx.ts"
    });
  }
  return infoCtxValue as InfoSync<T>;
}
