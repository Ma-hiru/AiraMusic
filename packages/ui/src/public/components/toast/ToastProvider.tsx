import { FC, memo, startTransition, useCallback, useLayoutEffect, useMemo, useState } from "react";
import { AnimatePresence, HTMLMotionProps, motion, MotionStyle } from "motion/react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import ToastItem, { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";
import { cx } from "@emotion/css";
import AppUI from "@mahiru/ui/public/player/ui";
import AppToast from "./use";

const ToastProvider: FC<{ className?: string }> = ({ className }) => {
  const [items, setItems] = useState<ToastItemData[]>([]);
  const { mainColor, textColorOnMain } = useThemeColor();

  const requestToast = useCallback((data: Omit<ToastItemData, "id">) => {
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
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const computedStyle = useMemo(() => {
    const textColor = textColorOnMain.string();
    const backgroundColor = mainColor.mix(AppUI.WHITE_COLOR, 0.6).alpha(0.92).string();
    const borderColor = mainColor.alpha(0.25).string();
    return { color: textColor, backgroundColor, borderColor };
  }, [mainColor, textColorOnMain]);

  /*prettier-ignore*/
  const Render = useCallback((
     items: ToastItemData[],
     style: MotionStyle,
     dispose: NormalFunc<[id: string]>
    ) => {
      return items.map((item) => (
        <motion.div
          layout
          drag="x"
          className={`
              px-2 py-1
              border border-solid rounded-sm shadow-lg
              select-none font-semibold text-[12px]
          `}
          key={item.id}
          style={style}
          onDragEnd={(_, info) =>
            Math.abs(info.offset.x) > 100 && dispose(item.id!)
          }
          {...ContainerProps}
        >
          <ToastItem data={item} id={item.id!} onDispose={dispose} />
        </motion.div>
      ));
    },
    []
  );

  useLayoutEffect(() => {
    AppToast.inject(requestToast, dispose);
  }, [dispose, requestToast]);

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
        {useMemo(() =>
          Render(items, computedStyle, dispose),
          [Render, computedStyle, items, dispose]
        )}
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
  dragConstraints: { left: 0, right: 0 },
  dragElastic: { left: 0.5, right: 0.5 }
};
