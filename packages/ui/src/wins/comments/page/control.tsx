import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import TopControl from "@/common/components/layout/top/control";
import Drag from "@/common/components/layout/drag/drag";

interface ControlProps {
  className?: string;
}

const Control: FC<ControlProps> = ({ className }) => {
  return (
    <Drag className={cx("w-screen flex flex-row justify-end items-center px-4", className)}>
      <TopControl mini pin className="gap-2!" />
    </Drag>
  );
};
export default memo(Control);
