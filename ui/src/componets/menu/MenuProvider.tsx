import { FC, Key, memo, ReactNode, useCallback, useEffect, useState } from "react";
import { motion, useAnimate } from "motion/react";
import { usePlayerStatus } from "@mahiru/ui/store";

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

  const { setContextMenuVisibleSetter, setContextMenuRenderer, setContextMenuVisible } =
    usePlayerStatus([
      "setContextMenuVisibleSetter",
      "setContextMenuRenderer",
      "setContextMenuVisible"
    ]);
  const SetContextMenuRenderData = useCallback((data: Nullable<ContextMenuRender>) => {
    setRender(data);
  }, []);
  const SetContextMenuVisible = useCallback((show?: boolean) => {
    if (typeof show === "boolean") {
      setVisible(show);
    } else {
      setVisible((v) => !v);
    }
  }, []);

  const OpenContextMenuAnimate = useCallback(async () => {
    await animate(
      scope.current,
      { opacity: [0, 1], scale: [0.96, 1], pointerEvents: "auto" },
      { duration: OPEN_DURATION, ease: "easeOut" }
    );
  }, [animate, scope]);
  const CloseContextMenuAnimate = useCallback(async () => {
    await animate(
      scope.current,
      { opacity: [1, 0], scale: [1, 0.96], pointerEvents: "none" },
      { duration: CLOSE_DURATION, ease: "easeIn" }
    );
  }, [animate, scope]);

  useEffect(() => {
    if (!render) return;
    if (visible) {
      CloseContextMenuAnimate().then(OpenContextMenuAnimate);
      setContextMenuVisible(true);
    } else {
      void CloseContextMenuAnimate();
      setContextMenuVisible(false);
    }
  }, [CloseContextMenuAnimate, OpenContextMenuAnimate, render, setContextMenuVisible, visible]);

  useEffect(() => {
    setContextMenuRenderer(() => SetContextMenuRenderData);
    setContextMenuVisibleSetter(() => SetContextMenuVisible);
  }, [
    SetContextMenuRenderData,
    SetContextMenuVisible,
    setContextMenuRenderer,
    setContextMenuVisibleSetter
  ]);

  return (
    <motion.div
      ref={scope}
      className="fixed z-15 overflow-hidden rounded-md bg-white/10 backdrop-blur-md border border-neutral-700/10 shadow-lg p-1"
      animate={{ left: render?.clientX, top: render?.clientY }}
      initial={{ opacity: 0, scale: 0.95, pointerEvents: "none" }}
      transition={{ duration: 0 }}>
      {!!render?.header && (
        <>
          <div className="px-1">{render.header}</div>
          <div className="mx-2 my-1 h-px bg-neutral-700/10" />
        </>
      )}
      <div className="flex flex-col space-y-1">
        {render?.items.map(({ prefix, label, suffix, id, onClick }, index) => {
          return (
            <div
              key={id || index}
              className="flex items-center gap-1.5 px-1 py-2 hover:bg-(--theme-color-main)/60 hover:text-(--text-color-on-main) cursor-default"
              onMouseDown={(e) => {
                e.stopPropagation();
                onClick?.();
                SetContextMenuVisible(false);
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
