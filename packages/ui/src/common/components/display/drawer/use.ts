import { useEffect } from "react";
import { Log } from "@/common/lib/log";
import { Inject } from "@/common/utils/inject";

import Provider, { type DrawerRender } from "./drawer-provider";

const defaultHandler = () => {
  Log.warn("AppDrawer", "Drawer is not provided in this app, or running under React StrictMode");
  return null;
};

@Inject
export default class AppDrawer {
  static __setDrawerData: NormalFunc<[data: Nullable<DrawerRender>]> = defaultHandler;
  static __setDrawerVisible: NormalFunc<[show?: boolean]> = defaultHandler;
  static __renderGetter: NormalFunc<[], Nullable<DrawerRender>> = defaultHandler;
  static __visibleGetter: NormalFunc<[], boolean> = () => defaultHandler() || false;

  static _create<const U extends unknown[]>(creator: NormalFunc<U, DrawerRender>, ...props: U) {
    AppDrawer.__setDrawerData?.(creator(...props));
    return AppDrawer.__visibleGetter;
  }

  static get useDrawer() {
    return useDrawer;
  }

  static close() {
    if (!AppDrawer.__visibleGetter?.()) return;
    AppDrawer.__setDrawerVisible?.(false);
  }

  static readonly Provider = Provider;
}

function useDrawer() {
  useEffect(() => {
    return () => {
      AppDrawer.__setDrawerData?.(null);
      AppDrawer.__setDrawerVisible?.(false);
    };
  }, []);

  return {
    create: AppDrawer._create,
    close: AppDrawer.close
  };
}
