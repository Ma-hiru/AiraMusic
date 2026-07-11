import { motion } from "motion/react";
import { memo, useRef, type FC, useEffect } from "react";
import { Ban, Info, CircleAlert, CircleCheck } from "lucide-react";

export type ToastItemData = {
  id?: string;
  text: string;
  type: "info" | "warn" | "error" | "success";
};

interface ToastItemProps {
  id: string;
  duration?: number;
  data: ToastItemData;
  onDispose?: NormalFunc<[id: string]>;
}

const ToastItem: FC<ToastItemProps> = ({ id, onDispose, data, duration = 5000 }) => {
  const timerRef = useRef(0);

  useEffect(() => {
    if (duration && onDispose) {
      timerRef.current = window.setTimeout(() => {
        onDispose?.(data.id || id);
      }, duration);
    }
    return () => {
      timerRef.current && clearTimeout(timerRef.current);
    };
  }, [data.id, duration, id, onDispose]);

  return (
    <motion.div
      className="w-full gap-1 flex justify-start items-center text-white"
      onMouseEnter={() => clearTimeout(timerRef.current)}
      onMouseLeave={() =>
        (timerRef.current = window.setTimeout(() => onDispose?.(data.id || id), duration))
      }>
      <span className="inline">{getTypeIcon(data.type)}</span>
      <span className="inline">{data.text}</span>
    </motion.div>
  );
};

export default memo(ToastItem);

function getTypeIcon(type: ToastItemData["type"]) {
  switch (type) {
    case "info":
      return <Info size={14} />;
    case "error":
      return <Ban size={14} />;
    case "success":
      return <CircleCheck size={14} />;
    case "warn":
      return <CircleAlert size={14} />;
    default:
      return null;
  }
}
