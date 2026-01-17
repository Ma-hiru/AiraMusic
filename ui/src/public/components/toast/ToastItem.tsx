import { FC, memo, useEffect, useRef } from "react";
import { motion } from "motion/react";

export type ToastItemData = {
  id?: string;
  type: "info" | "error" | "warn" | "success";
  text: string;
};

interface ToastItemProps {
  data: ToastItemData;
  id: string;
  duration?: number;
  onDispose?: NormalFunc<[id: string]>;
}

const ToastItem: FC<ToastItemProps> = ({ data, duration = 5000, onDispose, id }) => {
  const timerRef = useRef(0);

  useEffect(() => {
    if (duration && onDispose) {
      timerRef.current = window.setTimeout(() => onDispose?.(data.id || id), duration);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [data.id, duration, id, onDispose]);
  return (
    <motion.div
      layout
      drag="x"
      initial={{ opacity: 0, scale: 0.9, y: -20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="bg-neutral-900 text-white px-4 py-2 rounded-md shadow-lg"
      whileHover={{ scale: 1.05 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 100) onDispose?.(data.id || id);
      }}
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={() =>
        (timerRef.current = window.setTimeout(() => onDispose?.(data.id || id), duration))
      }>
      {data.type} - {data.text}
    </motion.div>
  );
};

export default memo(ToastItem);
