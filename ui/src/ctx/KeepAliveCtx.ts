import { createContext, useContext } from "react";
import { EqError } from "@mahiru/ui/utils/dev";

export interface KeepAliveCtxType {
  activeKey?: string;
}

export const KeepAliveCtx = createContext<KeepAliveCtxType>({
  activeKey: undefined
});

export function KeepAliveBuildKey(pathname: string, search?: string) {
  // playlist/:id 不分配独立缓存，统一使用 /playlist 作为 key
  if (pathname.startsWith("/playlist/")) return "/playlist";
  return `${pathname}${search ?? ""}`;
}

export function useKeepAliveCtx() {
  const ctxValue = useContext(KeepAliveCtx);
  if (!ctxValue) {
    throw new EqError({
      message: "useKeepAliveCtx must be used within a KeepAlive",
      label: "ui/KeepAliveCtx:useKeepAliveCtx"
    });
  }
  return ctxValue;
}
