import { FC, memo } from "react";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import { Drag } from "@mahiru/ui/componets/public/Drag";
import { cx } from "@emotion/css";
import { TransitionPreset } from "@mahiru/ui/constants/transition";

import ControlButton from "@mahiru/ui/page/layout/top/TopControl";
import AvatarMini from "@mahiru/ui/page/layout/top/TopAvatar";
import Transition from "@mahiru/ui/componets/public/Transition";
import Back from "@mahiru/ui/page/layout/top/Back";

const Top: FC<object> = () => {
  const { PlayerModalVisible } = useLayout();
  return (
    <Drag
      className={cx("absolute min-h-10 w-full flex items-center justify-between px-6 z-30", {
        "text-[#7b8290]": !PlayerModalVisible,
        "text-white": PlayerModalVisible
      })}>
      <Back />
      <div className="flex gap-4 justify-center items-center">
        <Transition show={PlayerModalVisible} {...TransitionPreset.OpacityPreset}>
          <div className="flex items-center gap-4">
            <AvatarMini />
            <span className="w-[2px] h-5 bg-white/50 scale-80"></span>
          </div>
        </Transition>
        <ControlButton windowId={"main"} />
      </div>
    </Drag>
  );
};
export default memo(Top);
