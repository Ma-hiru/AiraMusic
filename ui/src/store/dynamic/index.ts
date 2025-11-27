import { createZustandStore, createZustandShallowStore } from "../create";
import { DynamicStoreConfig, DynamicStoreInitialState, DynamicStoreActions } from "./config";

export type DynamicStoreType = DynamicStoreInitialState & DynamicStoreActions;

export const useDynamicZustandStore = createZustandStore(DynamicStoreConfig, "dynamic", false);

export const useDynamicZustandShallowStore =
  createZustandShallowStore<DynamicStoreType>(useDynamicZustandStore);

export const getDynamicSnapshot = useDynamicZustandStore.getState;
