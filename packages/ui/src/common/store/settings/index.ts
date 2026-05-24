import { useMemo } from "react";
import { SettingsStoreInitializer, type SettingsStoreType } from "./config";
import { createStoreSelectors, createZustandStore } from "@mahiru/ui/common/lib/store";
import { NeteaseSettings } from "@mahiru/ui/common/source/netease/models";

export const useSettingsStore = createZustandStore<SettingsStoreType>(SettingsStoreInitializer, {
  name: "settings",
  version: 1,
  persist: true
});

export const useSettingsStorePick = createStoreSelectors<SettingsStoreType>(useSettingsStore);

export const settingsStoreSnapshot = useSettingsStore.getState.bind(useSettingsStore);

export function useSettings() {
  const { _settings } = useSettingsStorePick(["_settings"]);
  return useMemo(() => NeteaseSettings.fromObject(_settings), [_settings]);
}

export type { SettingsStoreType } from "./config";
