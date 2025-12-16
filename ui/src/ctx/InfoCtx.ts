import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export const defaultInfoCtxValue = {
  type: "none",
  value: 0
} as InfoSync<any>;

export const defaultInfoThemeCtxValue = {
  type: "theme",
  value: {
    mainColor: "#fc3d49",
    secondaryColor: "#ffffff",
    textColor: "#ffffff",
    backgroundImage: undefined
  }
} as InfoSync<"theme">;

export const InfoCtx = createContext<InfoSync<any>>(defaultInfoCtxValue);

export const InfoThemeCtx = createContext<InfoSync<"theme">>(defaultInfoThemeCtxValue);

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

export function useInfoThemeCtx() {
  const infoThemeCtxValue = useContext(InfoThemeCtx);
  if (!infoThemeCtxValue) {
    throw new EqError({
      message: "useInfoThemeCtx must be used within a InfoLayout",
      label: "ui/InfoCtx:useInfoThemeCtx"
    });
  }
  return infoThemeCtxValue;
}
