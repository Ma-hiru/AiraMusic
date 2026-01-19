import { FC, memo, useCallback, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { UI } from "@mahiru/ui/public/entry/ui";
import { nextIdle } from "@mahiru/ui/public/utils/frame";
import { injectToast } from "@mahiru/ui/public/hooks/useToast";

import ToastItem, { ToastItemData } from "@mahiru/ui/public/components/toast/ToastItem";

const ToastProvider: FC<object> = () => {
  const [items, setItems] = useState<ToastItemData[]>([]);
  const { mainColor, textColorOnMain } = useThemeColor();
  const textColor = textColorOnMain.string();
  const backgroundColor = mainColor.mix(UI.Utils.WHITE, 0.6).alpha(0.92).string();
  const borderColor = mainColor.alpha(0.25).string();

  const requestToast = useCallback((data: Omit<ToastItemData, "id">) => {
    const id = window.crypto.randomUUID();
    void nextIdle(1000, () => {
      setItems((prev) => {
        const newItems = [...prev, { ...data, id }];
        if (newItems.length > 5) newItems.shift();
        return newItems;
      });
    });
    return id;
  }, []);

  const dispose = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useLayoutEffect(() => {
    injectToast(requestToast, dispose);
  }, [dispose, requestToast]);

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 duration-300 ease-in-out transition-all">
      <AnimatePresence mode="sync">
        {items.map((item) => (
          <motion.div
            layout
            drag="x"
            className="px-2 py-1 rounded-sm shadow-lg border border-solid select-none font-semibold text-[12px]"
            key={item.id}
            initial={{ opacity: 0, scale: 0.8, y: -25, x: 0 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              x: 0,
              transition: { duration: 0.25, ease: "easeOut" }
            }}
            exit={{
              opacity: 0,
              scale: 0.5,
              y: -50,
              x: 0,
              transition: { duration: 0.4, ease: "easeIn" }
            }}
            style={{ color: textColor, backgroundColor, borderColor }}
            whileHover={{ scale: 1.05 }}
            whileDrag={{ cursor: "grabbing" }}
            onDragEnd={(_, info) => {
              if (Math.abs(info.offset.x) > 100) dispose(item.id!);
            }}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.5, right: 0.5 }}>
            <ToastItem data={item} id={item.id!} onDispose={dispose} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
export default memo(ToastProvider);
