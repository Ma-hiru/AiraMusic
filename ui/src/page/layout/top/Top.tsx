import { FC, memo } from "react";
import ControlButton from "@mahiru/ui/page/layout/top/TopControl";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import AvatarMini from "@mahiru/ui/page/layout/top/TopAvatar";
import { Drag, NoDrag } from "@mahiru/ui/componets/public/Drag";
import Transition from "@mahiru/ui/componets/public/Transition";
import { cx } from "@emotion/css";
import { ChevronDown } from "lucide-react";
import { TransitionPreset } from "@mahiru/ui/constants/transition";

const Top: FC<object> = () => {
  const { TogglePlayerModalVisible, PlayerModalVisible } = useLayout();
  return (
    <Drag
      className={cx("absolute min-h-10 w-full flex items-center justify-between px-6 z-30", {
        "text-[#7b8290]": !PlayerModalVisible,
        "text-white": PlayerModalVisible
      })}>
      <NoDrag>
        <Transition
          tag={"button"}
          show={PlayerModalVisible}
          {...TransitionPreset.OpacityPreset}
          className="relative top-2"
          onClick={() => TogglePlayerModalVisible(false)}>
          <ChevronDown />
        </Transition>
      </NoDrag>
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
