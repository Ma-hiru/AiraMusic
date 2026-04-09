import { cx } from "@emotion/css";
import { FC, memo } from "react";

interface MaskProps {
  className?: string;
}

const Mask: FC<MaskProps> = ({ className }) => {
  return (
    <div
      className={cx(
        "w-screen h-screen fixed flex justify-center items-center flex-col bg-white gap-4",
        className
      )}>
      <img src="/images/logo.svg" alt="logo" className="size-16" />
      <p className="text-lg font-bold">{import.meta.env.APP_NAME}</p>
    </div>
  );
};

export default memo(Mask);
