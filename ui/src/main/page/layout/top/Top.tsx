import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { TransitionPreset } from "@mahiru/ui/public/constants/transition";

import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopBack from "./TopBack";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import Transition from "@mahiru/ui/public/components/public/Transition";

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
