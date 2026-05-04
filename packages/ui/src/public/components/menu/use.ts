import { ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { useLayoutEffect } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";
import { createTrackContextMenu } from "./TrackMenu";

export default class AppContextMenu {
  private static setContextMenuData: NormalFunc<[data: Nullable<ContextMenuRender>]> = () => {
    Log.warn("AppContextMenu", "ContextMenu is not provided in this app");
  };
  private static setContextMenuVisible: NormalFunc<[show?: boolean]> = () => {
    Log.warn("AppContextMenu", "ContextMenu is not provided in this app");
  };
  private static contextMenuVisibleGetter: NormalFunc<[], boolean> = () => {
    Log.warn("AppContextMenu", "ContextMenu is not provided in this app");
    return false;
  };

  private static readonly create = <U extends unknown[]>(
    creator: NormalFunc<U, ContextMenuRender>,
    ...props: U
  ) => {
    AppContextMenu.setContextMenuData?.(creator(...props));
    AppContextMenu.setContextMenuVisible?.(true);
    return AppContextMenu.contextMenuVisibleGetter;
  };

  static use() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useLayoutEffect(() => {
      return () => {
        AppContextMenu.setContextMenuData?.(null);
        AppContextMenu.setContextMenuVisible?.(false);
      };
    }, []);

    return {
      create: this.create,
      createTrackContextMenu
    };
  }

  static close() {
    if (!AppContextMenu.contextMenuVisibleGetter?.()) return;
    AppContextMenu.setContextMenuVisible?.(false);
  }

  static _inject(hooks: {
    setData: typeof AppContextMenu.setContextMenuData;
    setVisible: typeof AppContextMenu.setContextMenuVisible;
    visibleGetter: typeof AppContextMenu.contextMenuVisibleGetter;
  }) {
    AppContextMenu.setContextMenuData = hooks.setData;
    AppContextMenu.setContextMenuVisible = hooks.setVisible;
    AppContextMenu.contextMenuVisibleGetter = hooks.visibleGetter;
  }
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
