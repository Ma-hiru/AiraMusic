import { useEffect } from "react";
import { Renderer } from "@mahiru/ui/public/entry/renderer";

let loaded = false;

export function useAppLoaded(condition: boolean) {
  useEffect(() => {
    if (condition && !loaded) {
      Renderer.event.loaded({ broadcast: false });
      loaded = true;
    }
  }, [condition]);
  useEffect(() => {
    if (loaded) return;
    const timer = setTimeout(() => {
      if (loaded) return;
      loaded = true;
      Renderer.event.loaded({ broadcast: false });
    }, 10000);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return loaded;
}
