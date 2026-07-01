import { cx } from "@emotion/css";
import type { FC } from "react";

interface DividerProps {
  reverse?: boolean;
  className?: string;
}

const Divider: FC<DividerProps> = ({ className, reverse }) => {
  if (reverse) return <span className={cx("w-0.5 h-5 scale-80 bg-(--text-color)/20", className)} />;
  return <div className={cx("h-0.5 bg-(--text-color)/20 rounded-full", className)} />;
};

export default Divider;
