import { useMemo } from "react";
import { SettingsStoreInitializer, type SettingsStoreType } from "./config";
import { RendererZustandStoreCreator } from "@/common/lib/store";
import { NeteaseSettings } from "@/common/source/netease/models";

export const useSettingsStore = RendererZustandStoreCreator.createZustandStore<SettingsStoreType>(
  SettingsStoreInitializer,
  {
    name: "settings",
    version: 1,
    persist: true
  }
);

export const useSettingsStorePick =
  RendererZustandStoreCreator.createStoreSelectors<SettingsStoreType>(useSettingsStore);

export const settingsStoreSnapshot = useSettingsStore.getState.bind(useSettingsStore);

export function useSettings() {
  const { _settings } = useSettingsStorePick(["_settings"]);
  return useMemo(() => NeteaseSettings.fromObject(_settings), [_settings]);
}

export type { SettingsStoreType } from "./config";
