import { createZustandStore, createZustandShallowStore } from "../create";
import { PersistStoreActions, PersistStoreInitialState, PersistStoreConfig } from "./config";

export type PersistStoreType = PersistStoreInitialState & PersistStoreActions;

export const usePersistZustandStore = createZustandStore(PersistStoreConfig, "persist");

export const usePersistZustandShallowStore =
  createZustandShallowStore<PersistStoreType>(usePersistZustandStore);
