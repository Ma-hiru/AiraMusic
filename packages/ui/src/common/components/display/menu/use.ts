import { useEffect } from "react";
import { Log } from "@/common/lib/log";
import { InjectWithCallback } from "@/common/utils/inject";

import { createTrackContextMenu } from "./track-menu";
import MenuProvider, { type ContextMenuRender } from "./menu-provider";

const defaultHandler = () => {
  Log.warn(
    "AppContextMenu",
    "ContextMenu is not provided in this app, or running under React StrictMode"
  );
  return false;
};

let registered = false;

@InjectWithCallback(() => {
  if (registered) return;
  Log.info("AppContextMenu", "Registering context menu event listeners");
  registered = true;
  window.addEventListener("resize", AppContextMenu.close, {
    passive: true
  });
  window.addEventListener("click", AppContextMenu.close, {
    passive: true
  });
  window.addEventListener("scroll", AppContextMenu.close, {
    passive: true
  });
})
export default class AppContextMenu {
  static __setContextMenuData: NormalFunc<[data: Nullable<ContextMenuRender>]> = defaultHandler;
  static __setContextMenuVisible: NormalFunc<[show?: boolean]> = defaultHandler;
  static __contextMenuVisibleGetter: NormalFunc<[], boolean> = defaultHandler;

  static _create<U extends unknown[]>(creator: NormalFunc<U, ContextMenuRender>, ...props: U) {
    AppContextMenu.__setContextMenuData?.(creator(...props));
    AppContextMenu.__setContextMenuVisible?.(true);
    return AppContextMenu.__contextMenuVisibleGetter;
  }

  static get useMenu() {
    return useContextMenu;
  }

  static close() {
    if (!AppContextMenu.__contextMenuVisibleGetter?.()) return;
    AppContextMenu.__setContextMenuVisible?.(false);
  }

  static readonly Provider = MenuProvider;
}

function useContextMenu() {
  useEffect(() => {
    return () => {
      AppContextMenu.__setContextMenuData?.(null);
      AppContextMenu.__setContextMenuVisible?.(false);
    };
  }, []);

  return {
    create: AppContextMenu._create,
    createTrackContextMenu
  };
}
