import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import Drag from "@/common/components/layout/drag/drag";
import TopControl from "@/common/components/layout/top/control";

interface ControlProps {
  className?: string;
}

const Control: FC<ControlProps> = ({ className }) => {
  return (
    <Drag className={cx("w-screen flex flex-row justify-end items-center px-4", className)}>
      <TopControl className="gap-2!" pin mini />
    </Drag>
  );
};

export default memo(Control);
