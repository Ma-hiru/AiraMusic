import { createZustandShallowStore, createZustandStore } from "../create";
import { PersistStoreActions, PersistStoreConfig, PersistStoreInitialState } from "./config";

export type PersistStoreType = PersistStoreInitialState & PersistStoreActions;

export const usePersistZustandStore = createZustandStore(PersistStoreConfig, "persist", true);

export const usePersistZustandShallowStore =
  createZustandShallowStore<PersistStoreType>(usePersistZustandStore);

export const getPersistSnapshot = usePersistZustandStore.getState;

export const useSettings = () => {
  return usePersistZustandShallowStore(["settings", "updateSettings"]);
};

export const useSettingsSnapshot = () => {
  const { settings, updateSettings } = getPersistSnapshot();
  return { settings, updateSettings };
};
