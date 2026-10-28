import { useRef, useState, useEffect, useCallback } from "react";
import { RendererNet } from "@/common/lib/net";

export function useOnline(once = false) {
  const [ok, setOk] = useState(true);
  const [pending, setPending] = useState(false);
  const firstOk = useRef(false);
  const requestState = useRef({ mounted: false, id: 0 });

  const sync = useCallback(
    async (refresh = false) => {
      const state = requestState.current;
      if (!state.mounted || (!refresh && once && firstOk.current)) return;
      const currentId = ++state.id;
      setPending(true);
      try {
        const online = (await RendererNet.checkStatus(refresh)) === "ok";
        if (!state.mounted || currentId !== state.id) return;
        if (online) firstOk.current = true;
        setOk(online);
      } catch {
        if (state.mounted && currentId === state.id) setOk(false);
      } finally {
        if (state.mounted && currentId === state.id) setPending(false);
      }
    },
    [once]
  );

  const refresh = useCallback(() => sync(true), [sync]);

  useEffect(() => {
    const state = requestState.current;
    state.mounted = true;
    const unlisten = RendererNet.onOnlineChange(() => void sync());
    void sync();
    return () => {
      state.mounted = false;
      state.id++;
      unlisten();
    };
  }, [sync]);

  return { online: ok, pending, refresh };
}
