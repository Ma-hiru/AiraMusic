import { useCallback, useLayoutEffect } from "react";
import { Renderer } from "@mahiru/ui/public/entry/renderer";
import { Log } from "@mahiru/ui/public/utils/dev";

let loaded = false;

function _requestLoaded(broadcast = false, hide = false) {
  if (loaded) return;
  loaded = true;
  Renderer.event.loaded({ broadcast, hide });
  Log.trace("App loaded");
}

export function useAppLoaded(
  condition?: boolean,
  props?: { broadcast?: boolean; timeout?: number; hide?: boolean }
) {
  useLayoutEffect(() => {
    condition && _requestLoaded(props?.broadcast, props?.hide);
  }, [condition, props?.broadcast, props?.hide]);

  useLayoutEffect(() => {
    if (loaded || props?.timeout === 0) return;
    const timer = setTimeout(
      () => _requestLoaded(props?.broadcast, props?.hide),
      props?.timeout || 10000
    );
    return () => clearTimeout(timer);
  }, [props?.broadcast, props?.hide, props?.timeout]);

  useLayoutEffect(() => {
    Renderer.addMessageHandler(
      "otherWindowClosed",
      "main",
      () => {
        Renderer.event.close({ broadcast: false });
      },
      { id: "onMainExit" }
    );
  }, []);

  const requestLoaded = useCallback(() => {
    _requestLoaded(props?.broadcast, props?.hide);
  }, [props?.broadcast, props?.hide]);

  return {
    loaded,
    requestLoaded
  };
}
