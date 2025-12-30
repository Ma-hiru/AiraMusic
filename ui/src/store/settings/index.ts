import { createZustandShallowStore, createZustandStore } from "../create";
import { SettingsStoreActions, SettingsStoreConfig, SettingsStoreInitialState } from "./config";

export type SettingsStoreType = SettingsStoreInitialState & SettingsStoreActions;

const settingsStore = createZustandStore(SettingsStoreConfig, "settings", true);

export const useSettingsStore = createZustandShallowStore<SettingsStoreType>(settingsStore);

export const getSettingsStoreSnapshot = settingsStore.getState;
