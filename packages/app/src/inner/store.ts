import ElectronStore from "electron-store";
import { isDev } from "@mahiru/app/utils/dev";
import { Log } from "@mahiru/app/utils/log";

export type StoreType = Record<
  WindowType,
  {
    width: number;
    height: number;
    x: number;
    y: number;
  }
>;

export const AppStore = new ElectronStore<StoreType>();

if (isDev) {
  Log.info("Clearing store in development mode");
  AppStore.clear();
}
