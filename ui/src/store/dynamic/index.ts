import { createZustandShallowStore, createZustandStore } from "../create";
import { DynamicStoreActions, DynamicStoreConfig, DynamicStoreInitialState } from "./config";

export type DynamicStoreType = DynamicStoreInitialState & DynamicStoreActions;

export const useDynamicZustandStore = createZustandStore(DynamicStoreConfig, "dynamic", false);

export const useDynamicZustandShallowStore =
  createZustandShallowStore<DynamicStoreType>(useDynamicZustandStore);

export const getDynamicSnapshot = useDynamicZustandStore.getState;

export const usePlayerStatus = useDynamicZustandShallowStore;

export const getPlayerStatusSnapshot = getDynamicSnapshot;
