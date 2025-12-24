import { FC, memo } from "react";
import { usePlayerStatus } from "@mahiru/ui/store";
import { cx } from "@emotion/css";

const TopDivider: FC<object> = () => {
  const { playerModalVisible } = usePlayerStatus(["playerModalVisible"]);

  return (
    <span
      className={cx("w-0.5 h-5 scale-80", playerModalVisible ? "bg-white/50" : "bg-[#7b8290]/50")}
    />
  );
};
export default memo(TopDivider);
