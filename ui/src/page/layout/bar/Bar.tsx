import { FC, memo } from "react";
import BarCover from "@mahiru/ui/page/layout/bar/BarCover";
import BarControl from "@mahiru/ui/page/layout/bar/BarControl";
import BarProgress from "@mahiru/ui/page/layout/bar/BarProgress";
import BarBtns from "@mahiru/ui/page/layout/bar/BarBtns";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import SpectrumCanvas from "@mahiru/ui/componets/spectrum/SpectrumCanvas";

const Bar: FC<object> = () => {
  const { background } = useLayout();
  const { audioRef, isPlaying } = usePlayer();
  const { mainColor } = useThemeColor();
  return (
    <div
      className={cx(
        "absolute h-18 bottom-0 left-0 right-0 backdrop-blur-lg px-6 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)] grid grid-rows-1 grid-cols-[1fr_auto_1fr] items-center z-10 select-none",
        background ? "bg-white/50" : "bg-white"
      )}>
      <BarCover />
      <BarControl />
      <BarBtns />
      <BarProgress />
      <div className="absolute left-0 top-0 inset-0 pointer-events-none z-0">
        <SpectrumCanvas
          isPlaying={isPlaying}
          audioRef={audioRef}
          gap={1}
          color={mainColor}
          className="w-full h-full"
          spectrumOptions={{
            numBands: 500,
            withPeaks: true
          }}
        />
      </div>
    </div>
  );
};
export default memo(Bar);
