import ElectronStore from "electron-store";
import { MainRuntime } from "@/lib/runtime";
import { Log } from "@/lib/log";
import type { CacheStoreConfig } from "@/types/store";
import { MainPathResolver } from "@/lib/path-resolver";

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

export const MainStoreConfig = new ElectronStore<StoreType>({
  name: "config",
  encryptionKey: process.env.APP_NAME, // 仅仅是混淆而已，非安全用途
  encryptionAlgorithm: "aes-256-cbc",
  cwd: MainPathResolver.appUserDataJoin("key-value")
});

export const MainStoreForRenderer = new ElectronStore<Record<string, JsonValue>>({
  name: "renderer",
  encryptionKey: process.env.APP_NAME,
  encryptionAlgorithm: "aes-256-cbc",
  cwd: MainPathResolver.appUserDataJoin("key-value")
});

if (MainRuntime.isDev) {
  Log.info("Clearing store in development mode");
  MainStoreConfig.clear();
}
