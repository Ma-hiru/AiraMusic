import { KeepAliveBuildKey, useKeepAliveCtx } from "@mahiru/ui/ctx/KeepAliveCtx";

export function useRouterActive(location: Location) {
  const { activeKey } = useKeepAliveCtx();
  return KeepAliveBuildKey(location.pathname, location.search) === activeKey;
}
