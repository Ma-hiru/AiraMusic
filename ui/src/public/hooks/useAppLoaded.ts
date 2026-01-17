import { useLayoutEffect } from "react";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

let loaded = false;

function requestLoaded(broadcast = false, hide = false) {
  if (loaded) return;
  loaded = true;
  Renderer.event.loaded({ broadcast, hide });
}

export function useAppLoaded(
  condition?: boolean,
  props?: { broadcast?: boolean; timeout?: number; hide?: boolean }
) {
  useLayoutEffect(() => {
    condition && requestLoaded(props?.broadcast, props?.hide);
  }, [condition, props?.broadcast, props?.hide]);

  useLayoutEffect(() => {
    if (loaded || props?.timeout === 0) return;
    const timer = setTimeout(
      () => requestLoaded(props?.broadcast, props?.hide),
      props?.timeout || 10000
    );
    return () => clearTimeout(timer);
  }, [props?.broadcast, props?.hide, props?.timeout]);

  return {
    loaded,
    requestLoaded
  };
}
