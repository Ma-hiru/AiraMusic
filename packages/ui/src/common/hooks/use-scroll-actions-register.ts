import { useSetAtom, type PrimitiveAtom } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import { useLatestRef } from "@/common/hooks/use-latest-ref";

export interface ScrollActions {
  /** 回到顶部，null 表示当前不可用/不显示 */
  scrollTop: Optional<NormalFunc>;
  /** 定位到当前播放曲目，null 表示当前不可用/不显示 */
  fastLocate: Optional<NormalFunc>;
}

/**
 * 将"回到顶部 / 快速定位"两个动作注册到浮动按钮 atom。
 */
export function useScrollActionsRegister(props: {
  /** 当前页面是否处于激活路由 */
  active: boolean;
  /** 目标浮动按钮 atom（main/display 各自一份） */
  atom: PrimitiveAtom<ScrollActions>;
  getScrollTopFunc?: NormalFunc<[], Optional<NormalFunc>>;
  getFastLocateFunc?: NormalFunc<[], Optional<NormalFunc>>;
}) {
  const propsRef = useLatestRef(props);
  const setActions = useSetAtom(props.atom);
  const enabledRef = useRef({ scrollTop: false, fastLocate: false });
  // 记录本页注册过的函数引用，用于"只清理属于自己的槽位"，避免 keep-alive 下多页抢写竞态
  const ownedRef = useRef<ScrollActions>({ scrollTop: null, fastLocate: null });

  const sync = useCallback(() => {
    const { active, getScrollTopFunc, getFastLocateFunc } = propsRef.current;
    const myScrollTop = getScrollTopFunc?.() ?? null;
    const myFastLocate = getFastLocateFunc?.() ?? null;
    if (myScrollTop) ownedRef.current.scrollTop = myScrollTop;
    if (myFastLocate) ownedRef.current.fastLocate = myFastLocate;

    setActions((prev) => {
      let scrollTop: Optional<NormalFunc>;
      let fastLocate: Optional<NormalFunc>;
      if (active) {
        // 当前页：权威写入自身最终状态
        scrollTop = enabledRef.current.scrollTop ? myScrollTop : null;
        fastLocate = enabledRef.current.fastLocate ? myFastLocate : null;
      } else {
        // 非当前页：仅清理自己的
        scrollTop = prev.scrollTop === ownedRef.current.scrollTop ? null : prev.scrollTop;
        fastLocate = prev.fastLocate === ownedRef.current.fastLocate ? null : prev.fastLocate;
      }
      return prev.scrollTop === scrollTop && prev.fastLocate === fastLocate
        ? prev
        : { scrollTop, fastLocate };
    });
  }, [propsRef, setActions]);

  const canScrollTop = useCallback(
    (enable: boolean) => {
      if (enabledRef.current.scrollTop === enable) return;
      enabledRef.current.scrollTop = enable;
      sync();
    },
    [sync]
  );

  const canFastLocate = useCallback(
    (enable: boolean) => {
      if (enabledRef.current.fastLocate === enable) return;
      enabledRef.current.fastLocate = enable;
      sync();
    },
    [sync]
  );

  // 激活状态变化时重新同步
  useEffect(() => {
    sync();
  }, [props.active, sync]);

  // 卸载时清理
  useEffect(
    () => () => {
      setActions((prev) => {
        const scrollTop = prev.scrollTop === ownedRef.current.scrollTop ? null : prev.scrollTop;
        const fastLocate = prev.fastLocate === ownedRef.current.fastLocate ? null : prev.fastLocate;
        return prev.scrollTop === scrollTop && prev.fastLocate === fastLocate
          ? prev
          : { scrollTop, fastLocate };
      });
    },
    [setActions]
  );

  return { canScrollTop, canFastLocate };
}
