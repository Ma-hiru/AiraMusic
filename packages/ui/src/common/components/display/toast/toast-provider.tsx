import { cx } from "@emotion/css";
import { memo, startTransition, useCallback, useState } from "react";
import { AnimatePresence, type HTMLMotionProps, motion } from "motion/react";
import { ensureInjectObject, useInject } from "@/common/utils/inject";
import AppToast from "./use";

import ToastItem, { type ToastItemData } from "./toast-item";

const ToastProvider = ({
  className,
  itemContainerClassName
}: {
  className?: string;
  itemContainerClassName?: string;
}) => {
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
          className={cx(
            `
            px-2 py-1
            rounded-sm border border-white/30
            select-none font-semibold text-[12px]
            backdrop-saturate-120 backdrop-blur-md
            bg-black/15 shadow-[0_8px_32px_rgba(0,0,0,0.25)]
           `,
            itemContainerClassName
          )}
          key={item.id}
          onDragEnd={(_, info) => Math.abs(info.offset.x) > 100 && dispose(item.id!)}
          {...ContainerProps}>
          <ToastItem data={item} id={item.id!} onDispose={dispose} />
        </motion.div>
      ));
    },
    [dispose, itemContainerClassName]
  );

  useInject(ensureInjectObject(AppToast), {
    __show: show,
    __dispose: dispose
  });

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
        {Render(items)}
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
