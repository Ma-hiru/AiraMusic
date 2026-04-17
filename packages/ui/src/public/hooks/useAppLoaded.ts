import { useEffect } from "react";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

let loaded = false;

export function useAppLoaded(condition?: Optional<Promise<any>>) {
  useEffect(() => {
    if (loaded) return;
    (condition || Promise.resolve())
      .then(() => {
        ElectronServices.Window.current.show();
      })
      .catch(() => {
        ElectronServices.Window.current.close();
      })
      .finally(() => {
        loaded = true;
      });
  }, [condition]);
}
