import { cx } from "@emotion/css";
import { type FC, memo } from "react";

interface MaskProps {
  className?: string;
}

const AppMask: FC<MaskProps> = ({ className }) => {
  return (
    <div
      className={cx(
        "w-screen h-screen fixed flex justify-center items-center flex-col gap-4 top-0",
        className
      )}>
      <img src="/images/logo.svg" alt="logo" className="size-16" />
      <p className="text-lg font-bold text-(--text-color-on-main)">{import.meta.env.APP_NAME}</p>
    </div>
  );
};

export default memo(AppMask);
