import {
  type FC,
  type Key,
  memo,
  type ReactNode,
  useCallback,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { motion, useAnimate } from "motion/react";
import { cx } from "@emotion/css";
import { ensureInjectObject, useInject } from "@/common/utils/inject";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import AppContextMenu from "./use";

const DURATION = 0.15;

export type ContextMenuItem = {
  id?: Key;
  prefix?: ReactNode;
  label: ReactNode;
  suffix?: ReactNode;
  onClick?: () => void;
};

export type ContextMenuRender = {
  items: ContextMenuItem[];
  header?: ReactNode;
  clientX: number;
  clientY: number;
};

const MenuProvider: FC<{ className?: string }> = ({ className }) => {
  const [scope, animate] = useAnimate();
  const [visible, setVisible] = useState(false);
  const [render, setRender] = useState<Nullable<ContextMenuRender>>(null);

  const setContextMenuRenderData = setRender;

  const setContextMenuVisible = useCallback((show?: boolean) => {
    if (typeof show === "boolean") {
      setVisible(show);
    } else {
      setVisible((v) => !v);
    }
  }, []);

  const openContextMenuAnimate = useCallback(async () => {
    await animate(
      scope.current,
      { opacity: 1, scale: 1, pointerEvents: "auto" },
      { duration: DURATION, ease: "easeOut" }
    );
  }, [animate, scope]);

  const moveContextMenu = useCallback(
    async (x: number, y: number) => {
      const menu = scope.current;
      if (!menu) return;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const mh = menu.offsetHeight;
      const mw = menu.offsetWidth;

      let left = x;
      let top = y;

      if (x + mw > vw) {
        left = x - mw;
      }
      if (y + mh > vh) {
        top = y - mh;
      }

      const padding = 8;
      // left + mw <= vw - padding
      // padding <= left
      left = Math.max(padding, Math.min(left, vw - mw - padding));
      top = Math.max(padding, Math.min(top, vh - mh - padding));

      const originX = x + mw > vw ? "right" : "left";
      const originY = y + mh > vh ? "bottom" : "top";

      menu.style.transformOrigin = `${originX} ${originY}`;
      await animate(menu, { left, top }, { duration: 0 });
    },
    [animate, scope]
  );

  const closeContextMenuAnimate = useCallback(async () => {
    await animate(
      scope.current,
      { opacity: 0, scale: 0.96, pointerEvents: "none" },
      { duration: DURATION, ease: "easeIn" }
    );
  }, [animate, scope]);

  useLayoutEffect(() => {
    if (!render) {
      return;
    }
    if (visible) {
      closeContextMenuAnimate()
        .then(() => moveContextMenu(render.clientX, render.clientY))
        .then(openContextMenuAnimate);
    } else {
      void closeContextMenuAnimate();
    }
  }, [closeContextMenuAnimate, moveContextMenu, openContextMenuAnimate, render, visible]);

  const visibleRef = useLatestRef(visible);
  useInject(ensureInjectObject(AppContextMenu), {
    __setContextMenuData: setContextMenuRenderData,
    __setContextMenuVisible: setContextMenuVisible,
    __contextMenuVisibleGetter: useRef(() => visibleRef.current).current
  });

  return (
    <motion.div
      ref={scope}
      aria-hidden={!visible}
      className={cx(
        `
          fixed z-15 w-40 overflow-hidden rounded-md
          surface-popover p-1 contain-layout
          pointer-events-none opacity-0 shadow-none!
      `,
        className
      )}>
      {!!render?.header && (
        <>
          <div className="px-1 h-10">{render.header}</div>
          <div className="mx-2 my-1 h-px bg-neutral-700/10" />
        </>
      )}
      <div className="flex flex-col space-y-1" role="menu" aria-label="上下文菜单">
        {render?.items.map(({ prefix, label, suffix, id, onClick }, index) => {
          return (
            <button
              key={id || index}
              type="button"
              role="menuitem"
              tabIndex={visible ? 0 : -1}
              className={`
                  flex w-full items-center gap-1.5
                  rounded-md border-0 bg-transparent px-2 py-1 text-left
                  outline-none transition-colors duration-300 ease-in-out
                  hover:bg-primary
                  hover:text-primary-text
                  focus-visible:bg-primary
                  focus-visible:text-primary-text
                  focus-visible:ring-2 focus-visible:ring-primary/60
                  cursor-pointer
              `}
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
                setContextMenuVisible(false);
              }}>
              {!!prefix && prefix}
              {label}
              {!!suffix && suffix}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};
export default memo(MenuProvider);
