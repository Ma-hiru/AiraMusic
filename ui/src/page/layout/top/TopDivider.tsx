import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const TopDivider: FC<object> = () => {
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);

  return (
    <span className={cx("w-0.5 h-5 scale-80", PlayerVisible ? "bg-white/50" : "bg-[#7b8290]/50")} />
  );
};
export default memo(TopDivider);
