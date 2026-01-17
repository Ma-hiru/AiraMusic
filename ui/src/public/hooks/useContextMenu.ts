import { ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { EqError, Log } from "@mahiru/ui/public/utils/dev";
import { useLayoutEffect } from "react";

let setContextMenuData: NormalFunc<[data: Nullable<ContextMenuRender>]>;
let setContextMenuVisible: NormalFunc<[show?: boolean]>;
let contextMenuVisibleGetter: NormalFunc<[], boolean>;

const close = () => {
  if (!contextMenuVisibleGetter?.()) return;
  setContextMenuVisible?.(false);
};
window.addEventListener("resize", close, {
  passive: true
});
window.addEventListener("click", close, {
  passive: true
});
window.addEventListener("scroll", close, {
  passive: true
});

export function useContextMenu() {
  if (!setContextMenuData || !setContextMenuVisible) {
    Log.error(
      new EqError({
        label: "useContextMenu",
        message:
          "before using useContextMenu, make sure that MenuProvider is mounted and injectContextMenu has been called."
      })
    );
  }

  useLayoutEffect(() => {
    return () => {
      setContextMenuData?.(null);
      setContextMenuVisible?.(false);
    };
  }, []);

  return {
    setContextMenuData,
    setContextMenuVisible,
    get contextMenuVisible() {
      return contextMenuVisibleGetter();
    }
  };
}

export function injectContextMenu(
  setData: NormalFunc<[data: Nullable<ContextMenuRender>]>,
  setVisible: NormalFunc<[show?: boolean]>,
  visibleGetter: NormalFunc<[], boolean>
) {
  setContextMenuData = setData;
  setContextMenuVisible = setVisible;
  contextMenuVisibleGetter = visibleGetter;
}
