import { FC, memo } from "react";
import TopControlPure from "@mahiru/ui/common/components/public/TopControlPure";
import Drag from "@mahiru/ui/common/components/drag/Drag";
import { cx } from "@emotion/css";

interface ControlProps {
  className?: string;
}

const Control: FC<ControlProps> = ({ className }) => {
  return (
    <Drag
      className={cx(
        "w-screen flex flex-row justify-end items-center px-4 text-(--theme-color-main)",
        className
      )}>
      <TopControlPure />
    </Drag>
  );
};
export default memo(Control);
