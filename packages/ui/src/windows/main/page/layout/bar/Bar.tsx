import { cx } from "@emotion/css";
import { FC, memo } from "react";
import { useThemeColor } from "@mahiru/ui/common/hooks/useThemeColor";
import AppUI from "@mahiru/ui/common/player/ui";

import BarCover from "./BarCover";
import BarControl from "./BarControl";
import BarProgress from "./BarProgress";
import BarBtns from "./BarBtns";
import BarSpectrum from "./BarSpectrum";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";

const Bar: FC<{ className?: string }> = ({ className }) => {
  const { textColorOnMain } = useThemeColor();

  return (
    <div
      style={{
        background: AppUI.WHITE_COLOR.mix(textColorOnMain, 0.5).alpha(0.1).string()
      }}
      className={cx(
        `
        absolute bottom-0 left-0 right-0
        backdrop-blur-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)]
      `,
        className
      )}>
      <AppErrorBoundary name="PlayerBar" showError canReset className="w-full h-full">
        <BarProgress />
        <div className="relative w-full h-full grid grid-rows-1 backdrop-blur-md grid-cols-[1fr_auto_1fr] items-center select-none px-6 z-10 contain-strict">
          <BarCover />
          <BarControl />
          <BarBtns />
        </div>
        <div className="absolute left-0 top-0 inset-0 pointer-events-none z-0">
          <BarSpectrum />
        </div>
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Bar);
