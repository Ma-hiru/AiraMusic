import { Log } from "@/lib/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import ElectronStore from "electron-store";
import type { CacheStoreConfig } from "@/types/store";

export type StoreTypeForWindow = {
  [k in WindowType]: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type StoreTypeForConfig = {
  mcpPort: number;
  mcpTools: string[];
  mcpEnabled: boolean;
  agentEnabled: boolean;
  /** 旧版配置键，仅用于首次读取时迁移。 */
  cacheIndexKey: string;
  cache: CacheStoreConfig;
  enableDestructiveTools: boolean;
};

export type StoreTypeForRenderer = Record<string, JsonValue>;

export type StoreTypeForAgent = {
  /** Rust Agent store secret 经 Electron safeStorage 加密后的 base64 密文。 */
  agentStoreSecret?: string;
};

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

export const MainStoreForAgent = new ElectronStore<StoreTypeForAgent>({
  name: "agent",
  encryptionKey: process.env.APP_NAME,
  encryptionAlgorithm: "aes-256-cbc",
  cwd: MainPathResolver.appUserDataJoin("key-value")
});

if (MainRuntime.isDev) {
  Log.info("Clearing window store in development mode");
  MainStoreForWindow.clear();
}
