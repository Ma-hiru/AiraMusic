import { createZustandShallowStore, createZustandStore } from "../create";
import { LayoutStoreActions, LayoutStoreConfig, LayoutStoreInitialState } from "./config";

const layoutStore = createZustandStore(LayoutStoreConfig, "layout", false);

export const useLayoutStore = createZustandShallowStore<LayoutStoreType>(layoutStore);

export function LayoutStoreSnapshot(_: Function, ctx: ClassDecoratorContext) {
  ctx.addInitializer(function (this) {
    Object.defineProperty(this.prototype, "layoutSnapshot", {
      get() {
        return layoutStore.getState();
      }
    });
  });
}

export type LayoutStoreType = LayoutStoreInitialState & LayoutStoreActions;

export interface WithLayoutSnapshot {
  readonly layoutSnapshot: LayoutStoreType;
}
