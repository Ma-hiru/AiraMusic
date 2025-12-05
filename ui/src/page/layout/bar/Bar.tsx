import { FC, memo } from "react";
import BarCover from "@mahiru/ui/page/layout/bar/BarCover";
import BarControl from "@mahiru/ui/page/layout/bar/BarControl";
import BarProgress from "@mahiru/ui/page/layout/bar/BarProgress";
import BarBtns from "@mahiru/ui/page/layout/bar/BarBtns";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";
import BarSpectrum from "@mahiru/ui/page/layout/bar/BarSpectrum";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import Color from "color";

const Bar: FC<object> = () => {
  const { background } = useLayout();
  const textColor = useTextColorOnThemeColor();
  return (
    <div
      style={{
        background: background
          ? Color("#ffffff").mix(Color(textColor), 0.5).alpha(0.1).string()
          : Color("#ffffff").alpha(0.5).string()
      }}
      className="absolute h-18 bottom-0 left-0 right-0 backdrop-blur-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)] z-10">
      <div className="w-full h-full grid grid-rows-1 backdrop-blur-md grid-cols-[1fr_auto_1fr] items-center select-none px-6 relative z-10">
        <BarCover />
        <BarControl />
        <BarBtns />
        <BarProgress />
      </div>
      <div className="absolute left-0 top-0 inset-0 pointer-events-none z-0 flex justify-center">
        <BarSpectrum />
      </div>
    </div>
  );
};
export default memo(Bar);
