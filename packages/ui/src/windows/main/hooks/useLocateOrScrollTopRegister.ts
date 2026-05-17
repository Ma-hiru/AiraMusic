import { useCallback, useEffect, useMemo } from "react";
import { useLatestRef } from "@mahiru/ui/common/hooks/useLatestRef";
import { useLocation } from "react-router-dom";
import { useRouterActive } from "@mahiru/ui/common/hooks/useRouterActive";
import { useAtom } from "jotai";
import { scrollActionsAtom } from "@mahiru/ui/windows/main/atoms/layout";
import { debounce } from "lodash-es";

export function useLocateOrScrollTopRegister(props: {
  getScrollTopFunc?: NormalFunc<[], Optional<NormalFunc>>;
  getFastLocateFunc?: NormalFunc<[], Optional<NormalFunc>>;
}) {
  const location = useLocation();
  const active = useRouterActive(location);
  const propsRef = useLatestRef(props);
  const [scrollActions, setScrollActions] = useAtom(scrollActionsAtom);

  const atomRef = useLatestRef(scrollActions);

  const canScrollTop = useCallback(
    (enable: boolean) => {
      if (!propsRef.current.getScrollTopFunc) return;
      const scrollTop = propsRef.current.getScrollTopFunc();

      if (atomRef.current.scrollTop !== scrollTop && enable) {
        setScrollActions({
          ...atomRef.current,
          scrollTop
        });
      } else if (atomRef.current.scrollTop && !enable) {
        setScrollActions({
          ...atomRef.current,
          scrollTop: null
        });
      }
    },
    [atomRef, propsRef, setScrollActions]
  );

  const canFastLocate = useCallback(
    (enable: boolean) => {
      if (!propsRef.current.getFastLocateFunc) return;
      const fastLocator = propsRef.current.getFastLocateFunc();
      if (atomRef.current.fastLocate !== fastLocator && enable) {
        setScrollActions({
          ...atomRef.current,
          fastLocate: fastLocator
        });
      } else if (atomRef.current.fastLocate && !enable) {
        setScrollActions({
          ...atomRef.current,
          fastLocate: null
        });
      }
    },
    [atomRef, propsRef, setScrollActions]
  );

  useEffect(() => {
    if (!active) {
      canScrollTop(false);
      canFastLocate(false);
    } else {
      canScrollTop(true);
      canFastLocate(true);
    }
  }, [active, canFastLocate, canScrollTop]);

  return {
    canScrollTop: useMemo(
      () => debounce(canScrollTop, 1000, { leading: true, trailing: true }),
      [canScrollTop]
    ),
    canFastLocate: useMemo(
      () => debounce(canFastLocate, 1000, { leading: true, trailing: true }),
      [canFastLocate]
    )
  };
}
