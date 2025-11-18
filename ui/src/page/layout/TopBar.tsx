import { FC, memo } from "react";
import ControlButton from "@mahiru/ui/page/layout/componets/ControlButton";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";
import AvatarMini from "@mahiru/ui/page/layout/componets/AvatarMini";
import { Drag, NoDrag } from "@mahiru/ui/componets/public/Drag";
import Transition from "@mahiru/ui/componets/public/Transition";

const TopBar: FC<object> = () => {
  const { TogglePlayerModalVisible, PlayerModalVisible } = useLayout();
  return (
    <Drag className="absolute min-h-10 w-full flex items-center text-[#7b8290] justify-between px-6 z-30 py-1">
      <NoDrag>
        <Transition
          tag={"button"}
          show={PlayerModalVisible}
          {...transitionAnimation}
          onClick={() => {
            TogglePlayerModalVisible(false);
          }}>
          close
        </Transition>
      </NoDrag>
      <div className="flex gap-4 justify-center items-center">
        <Transition show={PlayerModalVisible} {...transitionAnimation}>
          <AvatarMini />
          <span className="w-[2px] h-5 bg-[#7b8290]/30 scale-80" />
        </Transition>
        <ControlButton windowId={"main"} />
      </div>
    </Drag>
  );
};
export default memo(TopBar);

const transitionAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: {
    duration: 0.3,
    ease: "easeInOut"
  }
} as const;
