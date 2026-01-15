import { createZustandShallowStore, createZustandStore } from "../../../public/utils/store";
import { LayoutStoreActions, LayoutStoreConfig, LayoutStoreInitialState } from "./config";

const layoutStore = createZustandStore(LayoutStoreConfig, "layout", false);

export type LayoutStoreType = LayoutStoreInitialState & LayoutStoreActions;

export const useLayoutStore = createZustandShallowStore<LayoutStoreType>(layoutStore);

export const getLayoutStoreSnapshot = layoutStore.getState.bind(layoutStore);

export function AddLayoutStore(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "layoutSnapshot", {
      get() {
        return layoutStore.getState();
      }
    });
  });
}

export interface WithLayoutStore {
  readonly layoutSnapshot: LayoutStoreType;
}
