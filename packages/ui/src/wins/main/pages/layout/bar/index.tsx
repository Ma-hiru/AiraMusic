import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { useSettings } from "@/common/store/settings";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import RendererTheme from "@/common/player/ui";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";

import BarBtns from "./bar-btns";
import BarCover from "./bar-cover";
import BarControl from "./bar-control";
import BarProgress from "./bar-progress";
import BarSpectrum from "./bar-spectrum";

const Bar: FC<{ className?: string }> = ({ className }) => {
  const { textColorOnMain } = useThemeColor();
  const settings = useSettings();
  return (
    <div
      className={cx(
        `
        absolute bottom-0 left-0 right-0
        border-t border-white/20 backdrop-saturate-150 backdrop-blur-2xl
        shadow-[0_-15px_26px_-26px_rgba(0,0,0,0.85)]
      `,
        className
      )}
      style={{
        background: RendererTheme.WHITE_COLOR.mix(textColorOnMain, 0.45).alpha(0.18).string()
      }}>
      <AppErrorBoundary className="w-full h-full" name="PlayerBar" canReset showError>
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
