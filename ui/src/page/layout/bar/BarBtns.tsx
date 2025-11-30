import { FC, memo } from "react";
import { useLyricSync } from "@mahiru/ui/hook/useLyricSync";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const BarBtns: FC<object> = () => {
  const { openLyricWin, hasOpenLyricWin } = useLyricSync();
  const { mainColor } = useThemeColor();
  return (
    <div className="flex gap-4 justify-end items-center h-full">
      <span
        style={{ color: hasOpenLyricWin ? mainColor : undefined }}
        onClick={openLyricWin}
        className="size-5 font-semibold hover:opacity-50 select-none cursor-pointer">
        词
      </span>
    </div>
  );
};
export default memo(BarBtns);
