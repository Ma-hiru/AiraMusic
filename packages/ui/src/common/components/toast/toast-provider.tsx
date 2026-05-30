import { cx } from "@emotion/css";
import { type FC, memo, startTransition, useCallback, useLayoutEffect, useState } from "react";
import { AnimatePresence, type HTMLMotionProps, motion } from "motion/react";
import AppToast from "./use";

import ToastItem, { type ToastItemData } from "./toast-item";

const ToastProvider: FC<{ className?: string }> = ({ className }) => {
  const [items, setItems] = useState<ToastItemData[]>([]);
  const show = useCallback((data: Omit<ToastItemData, "id">) => {
    const id = window.crypto.randomUUID();
    startTransition(() => {
      setItems((prev) => {
        const newItems = [...prev, { ...data, id }];
        newItems.length > 5 && newItems.shift();
        return newItems;
      });
    });
    return id;
  }, []);

  const dispose = useCallback((id: string) => {
    startTransition(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    });
  }, []);

  const Render = useCallback(
    (items: ToastItemData[]) => {
      return items.map((item) => (
        <motion.div
          className={`
              px-2 py-1
              rounded-sm shadow-lg border border-white/30
              select-none font-semibold text-[12px] bg-white/15 backdrop-blur-sm
          `}
          key={item.id}
          onDragEnd={(_, info) => Math.abs(info.offset.x) > 100 && dispose(item.id!)}
          {...ContainerProps}>
          <ToastItem data={item} id={item.id!} onDispose={dispose} />
        </motion.div>
      ));
    },
    [dispose]
  );

  useLayoutEffect(() => AppToast._inject({ show, dispose }), [dispose, show]);

  return (
    <div
      className={cx(
        `
        fixed top-4 left-1/2 -translate-x-1/2
        flex flex-col gap-2
      `,
        className
      )}>
      {/*prettier-ignore*/}
      <AnimatePresence mode="sync">
        {Render(items,  )}
      </AnimatePresence>
    </div>
  );
};

export default memo(ToastProvider);

const ContainerProps: HTMLMotionProps<"div"> = {
  initial: { opacity: 0, scale: 0.8, y: -25, x: 0 },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    x: 0,
    transition: { duration: 0.25, ease: "easeOut" }
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    y: -50,
    x: 0,
    transition: { duration: 0.4, ease: "easeIn" }
  },
  whileHover: { scale: 1.05 },
  whileDrag: { cursor: "grabbing" },
  layout: true,
  drag: "x",
  dragConstraints: { left: 0, right: 0 },
  dragElastic: { left: 0.5, right: 0.5 }
};
