import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export const InfoCtx = createContext<InfoSync>({
  type: "none",
  value: 0,
  mainColor: "",
  secondaryColor: "",
  textColor: ""
});

export function useInfoCtx() {
  const infoCtxValue = useContext(InfoCtx);
  if (!infoCtxValue) {
    throw new EqError({
      message: "useInfoCtx must be used within a InfoLayout",
      label: "ui/InfoCtx:useInfoCtx"
    });
  }
  return infoCtxValue;
}
