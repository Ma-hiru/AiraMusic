import { createContext, useContext } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";
import { RoutePathMain } from "@mahiru/ui/public/routes";

export interface KeepAliveCtxType {
  activeKey?: string;
}

export const KeepAliveCtx = createContext<KeepAliveCtxType>({
  activeKey: undefined
});

export function KeepAliveBuildKey(pathname: string, search?: string) {
  if (pathname === RoutePathMain.playlist.base) return pathname;
  return `${pathname}${search ?? ""}`;
}

export function useKeepAliveCtx() {
  const ctxValue = useContext(KeepAliveCtx);

  if (!ctxValue) {
    Log.throw("KeepAliveCtx", "KeepAliveCtx is not provided");
  }

  return ctxValue;
}
