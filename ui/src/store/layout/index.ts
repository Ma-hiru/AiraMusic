import { createZustandShallowStore, createZustandStore } from "../create";
import { LayoutStoreActions, LayoutStoreConfig, LayoutStoreInitialState } from "./config";

export type LayoutStoreType = LayoutStoreInitialState & LayoutStoreActions;

export const useLayoutStore = createZustandShallowStore<LayoutStoreType>(
  createZustandStore(LayoutStoreConfig, "layout", false)
);
