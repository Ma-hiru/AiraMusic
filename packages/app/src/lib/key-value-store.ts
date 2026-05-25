import ElectronStore from "electron-store";
import { MainRuntime } from "@/lib/runtime";
import { Log } from "@/lib/log";

export type StoreType = {
  [k in WindowType]: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
};

export const MainKeyValueStore = new ElectronStore<StoreType>();

if (MainRuntime.isDev) {
  Log.info("Clearing store in development mode");
  MainKeyValueStore.clear();
}
