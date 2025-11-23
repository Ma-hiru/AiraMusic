import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLyricSync } from "@mahiru/ui/hook/useLyricSync";

const BarBtns: FC<object> = () => {
  const { openLyricWin, hasOpenLyricWin } = useLyricSync();
  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <span
        onClick={openLyricWin}
        className={cx("size-5 font-semibold hover:opacity-50 select-none cursor-pointer", {
          "text-[#fc3d49]": hasOpenLyricWin
        })}>
        词
      </span>
    </div>
  );
};
export default memo(BarBtns);
