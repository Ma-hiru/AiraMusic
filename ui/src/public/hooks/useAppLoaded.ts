import { useEffect } from "react";
import AppWindow from "@mahiru/ui/public/entry/window";

let loaded = false;

export function useAppLoaded(condition?: Optional<Promise<any>>) {
  useEffect(() => {
    if (loaded) return;
    (condition || Promise.resolve())
      .then(() => {
        AppWindow.current.show();
      })
      .catch(() => {
        AppWindow.current.close();
      })
      .finally(() => {
        loaded = true;
      });
  }, [condition]);
}
