import { FC, Key, memo, ReactNode, useCallback, useEffect, useState } from "react";
import { motion, useAnimate } from "motion/react";
import { injectContextMenu } from "@mahiru/ui/public/hooks/useContextMenu";

const OPEN_DURATION = 0.15;
const CLOSE_DURATION = 0.08;

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

const MenuProvider: FC<object> = () => {
  const [scope, animate] = useAnimate();
  const [visible, setVisible] = useState(false);
  const [render, setRender] = useState<Nullable<ContextMenuRender>>(null);

  const setContextMenuRenderData = useCallback((data: Nullable<ContextMenuRender>) => {
    setRender(data);
  }, []);

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
      { opacity: [0, 1], scale: [0.96, 1], pointerEvents: "auto" },
      { duration: OPEN_DURATION, ease: "easeOut" }
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
      { opacity: [1, 0], scale: [1, 0.96], pointerEvents: "none" },
      { duration: CLOSE_DURATION, ease: "easeIn" }
    );
  }, [animate, scope]);

  useEffect(() => {
    if (!render) return;
    if (visible) {
      closeContextMenuAnimate()
        .then(() => moveContextMenu(render.clientX, render.clientY))
        .then(openContextMenuAnimate);
    } else {
      void closeContextMenuAnimate();
    }
  }, [closeContextMenuAnimate, moveContextMenu, openContextMenuAnimate, render, visible]);

  useEffect(() => {
    injectContextMenu(setContextMenuRenderData, setContextMenuVisible, () => visible);
  }, [setContextMenuRenderData, setContextMenuVisible, visible]);

  return (
    <motion.div
      ref={scope}
      className={`
          fixed z-15 w-40 overflow-hidden rounded-md
          bg-white/20 backdrop-blur-md p-1
          border border-neutral-700/10 shadow-lg
          pointer-events-none opacity-0
      `}>
      {!!render?.header && (
        <>
          <div className="px-1 h-10">{render.header}</div>
          <div className="mx-2 my-1 h-px bg-neutral-700/10" />
        </>
      )}
      <div className="flex flex-col space-y-1">
        {render?.items.map(({ prefix, label, suffix, id, onClick }, index) => {
          return (
            <div
              key={id || index}
              className={`
                  flex items-center gap-1.5
                  px-2 py-1 rounded-md
                  hover:bg-(--theme-color-main)/60
                  hover:text-(--text-color-on-main)
                  cursor-pointer
              `}
              onMouseDown={(e) => {
                e.stopPropagation();
                onClick?.();
                setContextMenuVisible(false);
              }}>
              {!!prefix && prefix}
              {label}
              {!!suffix && suffix}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
export default memo(MenuProvider);
