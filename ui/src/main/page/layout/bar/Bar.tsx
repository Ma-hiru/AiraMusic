import { FC, memo } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import AppUI from "@mahiru/ui/public/entry/ui";
// import { useStage } from "@mahiru/ui/public/hooks/useStage";
// import { Stage } from "@mahiru/ui/public/enum";
//
import BarCover from "./BarCover";
import BarControl from "./BarControl";
import BarProgress from "./BarProgress";
import BarBtns from "./BarBtns";
import { cx } from "@emotion/css";
// import BarSpectrum from "./BarSpectrum";

const Bar: FC<object> = () => {
  const { theme } = useLayoutStore();
  const { textColorOnMain } = useThemeColor();
  // const { stage } = useStage();
  return (
    <div
      style={{
        background: theme.backgroundCover
          ? AppUI.WHITE_COLOR.mix(textColorOnMain, 0.5).alpha(0.1).string()
          : AppUI.WHITE_COLOR.alpha(0.8).string()
      }}
      className={cx(
        `
        absolute h-18 bottom-0 left-0 right-0 z-20
        backdrop-blur-md shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)]
      `,
        theme.backgroundCover && "opacity-50"
      )}>
      <div className="w-full h-full grid grid-rows-1 backdrop-blur-md grid-cols-[1fr_auto_1fr] items-center select-none px-6 relative z-10">
        <BarCover />
        <BarControl />
        <BarBtns />
        <BarProgress />
      </div>
      <div className="absolute left-0 top-0 inset-0 pointer-events-none z-0 flex justify-center">
        {/*{stage >= Stage.Finally && <BarSpectrum />}*/}
      </div>
    </div>
  );
};
export default memo(Bar);
