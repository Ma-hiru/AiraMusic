import { createZustandShallowStore, createZustandStore } from "@mahiru/ui/public/utils/store";
import { LayoutStoreConfig, LayoutStoreType } from "./config";

export type { LayoutStoreType } from "./config";

const layoutStore = createZustandStore(LayoutStoreConfig, "layout", false);

export const useLayoutStore = createZustandShallowStore<LayoutStoreType>(layoutStore);

export const getLayoutStoreSnapshot = layoutStore.getState.bind(layoutStore);
