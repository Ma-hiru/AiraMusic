import ElectronStore from "electron-store";
import { MainRuntime } from "@/lib/runtime";
import { Log } from "@/lib/log";
import type { CacheStoreConfig } from "@/types/store";

export type StoreType = {
  [k in WindowType | "cache"]: k extends "cache"
    ? CacheStoreConfig
    : {
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
