import { FC, memo } from "react";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import { cx } from "@emotion/css";
import { TransitionPreset } from "@mahiru/ui/constants/transition";
import { useLayoutStore } from "@mahiru/ui/store/layout";

import TopControl from "@mahiru/ui/page/layout/top/TopControl";
import TopAvatar from "@mahiru/ui/page/layout/top/TopAvatar";
import Transition from "@mahiru/ui/componets/public/Transition";
import TopBack from "@mahiru/ui/page/layout/top/TopBack";
import TopDivider from "@mahiru/ui/page/layout/top/TopDivider";
import TopSearch from "@mahiru/ui/page/layout/top/TopSearch";

const Top: FC<object> = () => {
  const { PlayerVisible } = useLayoutStore(["PlayerVisible"]);
  return (
    <Drag
      className={cx(
        "absolute min-h-10 w-full flex items-center justify-between px-6 z-30",
        PlayerVisible ? "text-white" : "text-[#7b8290]"
      )}>
      <div className="absolute z-10 left-6">
        <TopBack />
      </div>
      <div />
      <div className="flex gap-4 justify-center items-center">
        <TopSearch />
        <Transition show={PlayerVisible} {...TransitionPreset.OpacityPreset}>
          <TopAvatar />
        </Transition>
        <TopDivider />
        <TopControl windowId={"main"} />
      </div>
    </Drag>
  );
};
export default memo(Top);
