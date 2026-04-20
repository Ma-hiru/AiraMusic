import { ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { useLayoutEffect } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";
import { createTrackContextMenu } from "@mahiru/ui/public/components/menu/TrackMenu";

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

  static useContextMenu() {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useLayoutEffect(() => {
      return () => {
        AppContextMenu.setContextMenuData?.(null);
        AppContextMenu.setContextMenuVisible?.(false);
      };
    }, []);

    return {
      setContextMenuData: AppContextMenu.setContextMenuData,
      setContextMenuVisible: AppContextMenu.setContextMenuVisible,
      get contextMenuVisible() {
        return AppContextMenu.contextMenuVisibleGetter();
      },
      createTrackContextMenu
    };
  }

  static inject(
    setData: NormalFunc<[data: Nullable<ContextMenuRender>]>,
    setVisible: NormalFunc<[show?: boolean]>,
    visibleGetter: NormalFunc<[], boolean>
  ) {
    AppContextMenu.setContextMenuData = setData;
    AppContextMenu.setContextMenuVisible = setVisible;
    AppContextMenu.contextMenuVisibleGetter = visibleGetter;
  }

  static close() {
    if (!AppContextMenu.contextMenuVisibleGetter?.()) return;
    AppContextMenu.setContextMenuVisible?.(false);
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
