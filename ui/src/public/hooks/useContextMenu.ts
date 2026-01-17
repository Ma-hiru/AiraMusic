import { ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { useLayoutEffect } from "react";
import { Log } from "@mahiru/ui/public/utils/dev";
import { Errs } from "@mahiru/ui/public/entry/errs";

let setContextMenuData: NormalFunc<[data: Nullable<ContextMenuRender>]> = () => {
  Log.error(Errs.ContextMenuBeforeInject.create("setContextMenuData"));
};
let setContextMenuVisible: NormalFunc<[show?: boolean]> = () => {
  Log.error(Errs.ContextMenuBeforeInject.create("setContextMenuVisible"));
};
let contextMenuVisibleGetter: NormalFunc<[], boolean> = () => {
  Log.error(Errs.ContextMenuBeforeInject.create("contextMenuVisibleGetter"));
  return false;
};

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
