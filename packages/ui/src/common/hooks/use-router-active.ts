import { type Location } from "react-router-dom";
import { KeepAliveBuildKey, useKeepAliveCtx } from "@/wins/main/ctx/keep-alive-ctx";

export function useRouterActive(location: Location) {
  const { activeKey } = useKeepAliveCtx();
  return KeepAliveBuildKey(location.pathname, location.search) === activeKey;
}
