import { Log } from "@/lib/log";
import { MainRuntime } from "@/lib/runtime";
import { MainPathResolver } from "@/lib/path-resolver";
import ElectronStore from "electron-store";
import type { CacheStoreConfig } from "@/types/store";
import type { LLMConversationSnapshot, AIProviderConfigSnapshot } from "@mahiru/ai";

export type StoreTypeForWindow = {
  [k in WindowType]: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type StoreTypeForConfig = {
  enableAgent: boolean;
  cacheIndexKey: string;
  cache: CacheStoreConfig;
};

export type StoreTypeForRenderer = Record<string, JsonValue>;

export type StoreTypeForAgent = {
  providerAPIKeys: Record<string, string>;
  conversations: Record<string, LLMConversationSnapshot>;
  providerConfigs: Record<string, AIProviderConfigSnapshot>;
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
