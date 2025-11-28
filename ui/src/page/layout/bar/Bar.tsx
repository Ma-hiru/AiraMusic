import { FC, memo } from "react";
import BarCover from "@mahiru/ui/page/layout/bar/BarCover";
import BarControl from "@mahiru/ui/page/layout/bar/BarControl";
import BarProgress from "@mahiru/ui/page/layout/bar/BarProgress";
import BarBtns from "@mahiru/ui/page/layout/bar/BarBtns";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { cx } from "@emotion/css";

const Bar: FC<object> = () => {
  const { background } = useLayout();
  return (
    <div
      className={cx(
        "absolute h-18 bottom-0 left-0 right-0 backdrop-blur-lg px-6 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.25)] grid grid-rows-1 grid-cols-[1fr_auto_1fr] items-center z-10",
        background ? "bg-transparent" : "bg-white"
      )}>
      <BarCover />
      <BarControl />
      <BarBtns />
      <BarProgress />
    </div>
  );
};
export default memo(Bar);
