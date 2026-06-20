import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { useSettings } from "@/common/store/settings";
import RendererTheme from "@/common/player/ui";

import BarCover from "./bar-cover";
import BarControl from "./bar-control";
import BarProgress from "./bar-progress";
import BarBtns from "./bar-btns";
import BarSpectrum from "./bar-spectrum";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";

const Bar: FC<{ className?: string }> = ({ className }) => {
  const { textColorOnMain } = useThemeColor();
  const settings = useSettings();
  return (
    <div
      style={{
        background: RendererTheme.WHITE_COLOR.mix(textColorOnMain, 0.5).alpha(0.1).string()
      }}
      className={cx(
        `
        absolute bottom-0 left-0 right-0 bg-white/30
        backdrop-saturate-120 backdrop-blur-lg backdrop-saturate shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)]
      `,
        className
      )}>
      <AppErrorBoundary name="PlayerBar" showError canReset className="w-full h-full">
        <BarProgress />
        <div className="relative w-full h-full grid grid-rows-1 backdrop-blur-md grid-cols-[1fr_auto_1fr] items-center select-none px-6 z-10 contain-layout">
          <BarCover />
          <BarControl />
          <BarBtns />
        </div>
        {settings.performance.barSpectrum && (
          <div className="absolute left-0 top-0 inset-0 pointer-events-none z-0">
            <BarSpectrum />
          </div>
        )}
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Bar);
