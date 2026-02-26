import { useCallback, useEffect } from "react";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { Log } from "@mahiru/ui/public/utils/dev";

let loaded = false;

function _requestLoaded(broadcast = false, hide = false) {
  if (loaded) return;
  loaded = true;
  Renderer.event.loaded({ broadcast, hide });
  Log.debug("App loaded");
}

export function useAppLoaded(
  condition?: boolean,
  props?: { broadcast?: boolean; timeout?: number; hide?: boolean }
) {
  const requestLoaded = useCallback(() => {
    _requestLoaded(props?.broadcast, props?.hide);
  }, [props?.broadcast, props?.hide]);

  useEffect(() => {
    condition && requestLoaded();
  }, [condition, requestLoaded]);

  useEffect(() => {
    if (loaded || props?.timeout === 0) return;
    const timer = setTimeout(requestLoaded, props?.timeout || 10000);
    return () => clearTimeout(timer);
  }, [requestLoaded, props?.timeout]);

  useEffect(() => {
    Renderer.addMessageHandler(
      "otherWindowClosed",
      "main",
      () => {
        Renderer.event.close({ broadcast: false });
      },
      { id: "onMainExit" }
    );
  }, []);

  return {
    loaded,
    requestLoaded
  };
}
