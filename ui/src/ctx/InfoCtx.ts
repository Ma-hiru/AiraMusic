import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export const defaultInfoCtxValue = {
  type: "none",
  value: 0,
  mainColor: "#fc3d49",
  secondaryColor: "#ffffff",
  textColor: "#ffffff",
  backgroundImage: undefined
} as InfoSync<any>;

export const InfoCtx = createContext<InfoSync<any>>(defaultInfoCtxValue);

export function useInfoCtx<T extends InfoSyncType>() {
  const infoCtxValue = useContext(InfoCtx);
  if (!infoCtxValue) {
    throw new EqError({
      message: "useInfoCtx must be used within a InfoLayout",
      label: "ui/InfoCtx:useInfoCtx"
    });
  }
  return infoCtxValue as InfoSync<T>;
}
