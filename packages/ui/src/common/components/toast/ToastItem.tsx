import { FC, memo, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { Ban, CircleAlert, CircleCheck, Info } from "lucide-react";

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
      className="w-full gap-1 flex justify-start items-center"
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
      return <Ban size={14} color={"#ff4d4f"} />;
    case "success":
      return <CircleCheck size={14} color={"#52c41a"} />;
    case "warn":
      return <CircleAlert size={14} color={"#faad14"} />;
    default:
      return null;
  }
}
