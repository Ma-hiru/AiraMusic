import { createZustandStore, createZustandShallowStore } from "../create";
import { PersistStoreActions, PersistStoreInitialState, PersistStoreConfig } from "./config";

export type PersistStoreType = PersistStoreInitialState & PersistStoreActions;

export const usePersistZustandStore = createZustandStore(PersistStoreConfig, "persist", true);

export const usePersistZustandShallowStore =
  createZustandShallowStore<PersistStoreType>(usePersistZustandStore);

export const getPersistSnapshot = usePersistZustandStore.getState;
