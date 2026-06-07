import { type FC, memo } from "react";
import TopControlPure from "@/common/components/layout/top/control";
import Drag from "@/common/components/layout/drag/drag";
import { cx } from "@emotion/css";

interface ControlProps {
  className?: string;
}

const Control: FC<ControlProps> = ({ className }) => {
  return (
    <Drag className={cx("w-screen flex flex-row justify-end items-center px-4", className)}>
      <TopControlPure />
    </Drag>
  );
};
export default memo(Control);
