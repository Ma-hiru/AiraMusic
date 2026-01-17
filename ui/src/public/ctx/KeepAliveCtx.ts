import { createContext, useContext } from "react";
import { Errs } from "@mahiru/ui/public/entry/errs";
import { Log } from "@mahiru/ui/public/utils/dev";

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
    Log.error(Errs.KeepAliveNoProvider.create("useKeepAliveCtx"));
  }
  return ctxValue;
}
