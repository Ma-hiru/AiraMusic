import { useEffect } from "react";

let loaded = false;

export function useAppLoaded(condition: boolean) {
  useEffect(() => {
    if (condition && !loaded) {
      window.node.event.loaded({
        win: "main",
        broadcast: false,
        showAfterLoaded: true
      });
      loaded = true;
    }
  }, [condition]);
}
