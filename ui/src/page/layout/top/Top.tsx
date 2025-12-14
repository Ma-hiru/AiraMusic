import { FC, memo } from "react";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import { cx } from "@emotion/css";
import { TransitionPreset } from "@mahiru/ui/constants/transition";

import ControlButton from "@mahiru/ui/page/layout/top/TopControl";
import AvatarMini from "@mahiru/ui/page/layout/top/TopAvatar";
import Transition from "@mahiru/ui/componets/public/Transition";
import Back from "@mahiru/ui/page/layout/top/Back";
import { useLayoutStatus } from "@mahiru/ui/store";

const Top: FC<object> = () => {
  const { playerModalVisible } = useLayoutStatus(["playerModalVisible"]);
  return (
    <Drag
      className={cx(
        "absolute min-h-10 w-full flex items-center justify-between px-6 z-30",
        playerModalVisible ? "text-white" : "text-[#7b8290]"
      )}>
      <div className="absolute z-10 left-6">
        <Back />
      </div>
      <div />
      <div className="flex gap-4 justify-center items-center">
        <Transition show={playerModalVisible} {...TransitionPreset.OpacityPreset}>
          <div className="flex items-center gap-4">
            <AvatarMini />
            <span className="w-0.5 h-5 bg-white/50 scale-80"></span>
          </div>
        </Transition>
        <ControlButton windowId={"main"} />
      </div>
    </Drag>
  );
};
export default memo(Top);
