import type { FC } from "react";
import { cx } from "@emotion/css";

interface DividerProps {
  className?: string;
}

const Divider: FC<DividerProps> = ({ className }) => {
  return <div className={cx("h-0.5 bg-(--text-color-on-main)/20 rounded-full", className)} />;
};

export default Divider;
