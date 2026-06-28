import ElectronStore from "electron-store";
import { Log } from "@/lib/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import type { CacheStoreConfig } from "@/types/store";

export type StoreTypeForWindow = {
  [k in WindowType]: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
};

export type StoreTypeForConfig = {
  cache: CacheStoreConfig;
  cacheIndexKey: string;
};

export type StoreTypeForRenderer = Record<string, JsonValue>;

export const MainStoreForWindow = new ElectronStore<StoreTypeForWindow>({
  name: "window",
  encryptionKey: process.env.APP_NAME, // 仅仅是混淆而已，非安全用途
  encryptionAlgorithm: "aes-256-cbc",
  cwd: MainPathResolver.appUserDataJoin("key-value")
});

export const MainStoreForConfig = new ElectronStore<StoreTypeForConfig>({
  name: "config",
  encryptionKey: process.env.APP_NAME,
  encryptionAlgorithm: "aes-256-cbc",
  cwd: MainPathResolver.appUserDataJoin("key-value")
});

export const MainStoreForRenderer = new ElectronStore<StoreTypeForRenderer>({
  name: "renderer",
  encryptionKey: process.env.APP_NAME,
  encryptionAlgorithm: "aes-256-cbc",
  cwd: MainPathResolver.appUserDataJoin("key-value")
});

if (MainRuntime.isDev) {
  Log.info("Clearing window store in development mode");
  MainStoreForWindow.clear();
}
