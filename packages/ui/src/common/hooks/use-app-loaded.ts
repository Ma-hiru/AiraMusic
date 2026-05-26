import { useEffect } from "react";
import { RendererWindow } from "@/common/lib/window";

let loaded = false;

export function useAppLoaded(condition?: Optional<Promise<any>>) {
  useEffect(() => {
    if (loaded) return;
    (condition || Promise.resolve())
      .then(() => {
        RendererWindow.current.show();
      })
      .catch(() => {
        RendererWindow.current.close();
      })
      .finally(() => {
        loaded = true;
      });
  }, [condition]);
}
