import { cx } from "@emotion/css";
import { memo, type FC, type HTMLAttributes } from "react";

const TopDivider: FC<HTMLAttributes<HTMLSpanElement>> = ({ className, ...props }) => {
  return <span className={cx("w-0.5 h-5 scale-80 bg-[#7b8290]/50", className)} {...props} />;
};

export default memo(TopDivider);
