import { useEffect } from "react";
import { ElectronServicesWindow } from "../source/electron/services";

let loaded = false;

export function useAppLoaded(condition?: Optional<Promise<any>>) {
  useEffect(() => {
    if (loaded) return;
    (condition || Promise.resolve())
      .then(() => {
        ElectronServicesWindow.current.show();
      })
      .catch(() => {
        ElectronServicesWindow.current.close();
      })
      .finally(() => {
        loaded = true;
      });
  }, [condition]);
}
