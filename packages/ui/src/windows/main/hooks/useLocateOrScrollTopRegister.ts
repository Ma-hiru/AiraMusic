import { useCallback } from "react";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";
import { useLatestRef } from "@mahiru/ui/public/hooks/useLatestRef";

export function useLocateOrScrollTopRegister(props: {
  getScrollTopFunc?: NormalFunc<[], Optional<NormalFunc>>;
  getFastLocateFunc?: NormalFunc<[], Optional<NormalFunc>>;
}) {
  const propsRef = useLatestRef(props);

  const canScrollTop = useCallback(
    (enable: boolean) => {
      if (!propsRef.current.getScrollTopFunc) return;
      const layout = getLayoutStoreSnapshot().layout;
      const updateLayout = getLayoutStoreSnapshot().updateLayout;
      const scrollTop = propsRef.current.getScrollTopFunc();
      if (layout.scrollTop() !== scrollTop && enable) {
        updateLayout(layout.copy().setScrollTop(scrollTop));
      } else if (layout.scrollTop() !== undefined && !enable) {
        updateLayout(layout.copy().setScrollTop(undefined));
      }
    },
    [propsRef]
  );

  const canFastLocate = useCallback(
    (enable: boolean) => {
      if (!propsRef.current.getFastLocateFunc) return;
      const layout = getLayoutStoreSnapshot().layout;
      const fastLocator = propsRef.current.getFastLocateFunc();
      const updateLayout = getLayoutStoreSnapshot().updateLayout;
      if (layout.fastLocator() !== fastLocator && enable) {
        updateLayout(layout.copy().setFastLocator(fastLocator));
      } else if (layout.fastLocator() !== undefined && !enable) {
        updateLayout(layout.copy().setFastLocator(undefined));
      }
    },
    [propsRef]
  );

  return {
    canScrollTop,
    canFastLocate
  };
}
