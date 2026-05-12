import { ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { useLayoutEffect } from "react";
import { Log } from "@mahiru/ui/public/constants/dev";
import { createTrackContextMenu } from "./TrackMenu";
import MenuProvider from "./MenuProvider";

export default class AppContextMenu {
  static _setContextMenuData: NormalFunc<[data: Nullable<ContextMenuRender>]> = () => {
    Log.warn("AppContextMenu", "ContextMenu is not provided in this app");
  };
  static _setContextMenuVisible: NormalFunc<[show?: boolean]> = () => {
    Log.warn("AppContextMenu", "ContextMenu is not provided in this app");
  };
  private static contextMenuVisibleGetter: NormalFunc<[], boolean> = () => {
    Log.warn("AppContextMenu", "ContextMenu is not provided in this app");
    return false;
  };

  static readonly _create = <U extends unknown[]>(
    creator: NormalFunc<U, ContextMenuRender>,
    ...props: U
  ) => {
    AppContextMenu._setContextMenuData?.(creator(...props));
    AppContextMenu._setContextMenuVisible?.(true);
    return AppContextMenu.contextMenuVisibleGetter;
  };

  static get useMenu() {
    return useContextMenu;
  }

  static close() {
    if (!AppContextMenu.contextMenuVisibleGetter?.()) return;
    AppContextMenu._setContextMenuVisible?.(false);
  }

  static _inject(hooks: {
    setData: typeof AppContextMenu._setContextMenuData;
    setVisible: typeof AppContextMenu._setContextMenuVisible;
    visibleGetter: typeof AppContextMenu.contextMenuVisibleGetter;
  }) {
    AppContextMenu._setContextMenuData = hooks.setData;
    AppContextMenu._setContextMenuVisible = hooks.setVisible;
    AppContextMenu.contextMenuVisibleGetter = hooks.visibleGetter;
  }

  static readonly Provider = MenuProvider;
}

window.addEventListener("resize", AppContextMenu.close, {
  passive: true
});
window.addEventListener("click", AppContextMenu.close, {
  passive: true
});
window.addEventListener("scroll", AppContextMenu.close, {
  passive: true
});

function useContextMenu() {
  useLayoutEffect(() => {
    return () => {
      AppContextMenu._setContextMenuData?.(null);
      AppContextMenu._setContextMenuVisible?.(false);
    };
  }, []);

  return {
    create: AppContextMenu._create,
    createTrackContextMenu
  };
}
