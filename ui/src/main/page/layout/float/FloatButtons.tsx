import { FC, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronUp, LocateFixed, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import FloatItem from "./FloatItem";

const FloatButtons: FC<object> = () => {
  const { ScrollTop, ToggleSideBarOpen, PlayerVisible, TrackListFastLocater, SideBarOpen } =
    useLayoutStore([
      "ScrollTop",
      "ToggleSideBarOpen",
      "PlayerVisible",
      "TrackListFastLocater",
      "SideBarOpen"
    ]);
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    navigate(-1);
  };

  // 在首页或根路径时不显示返回按钮
  const hiddenBack = !(location.pathname === "/" || location.pathname === "/home");

  const locator = TrackListFastLocater?.() || undefined;
  return (
    <AnimatePresence initial={false}>
      {!PlayerVisible && (
        <motion.div
          key="floatButtons"
          className="absolute right-10 bottom-24 z-30 flex justify-center items-center flex-col w-10 gap-2"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ease: "easeInOut", duration: 0.3 }}>
          <AnimatePresence initial={false}>
            {ScrollTop.type !== "none" && (
              <FloatItem key="scrollTop" onClick={ScrollTop.callback || undefined}>
                <ChevronUp className="size-5" />
              </FloatItem>
            )}
            {locator && (
              <FloatItem key="locate" onClick={locator}>
                <LocateFixed className="size-5" />
              </FloatItem>
            )}
            {hiddenBack && (
              <FloatItem key="back" onClick={handleBack}>
                <ChevronLeft className="size-5" />
              </FloatItem>
            )}
            <FloatItem key="sidebar" onClick={ToggleSideBarOpen}>
              {SideBarOpen ? (
                <PanelLeftClose className="size-5" />
              ) : (
                <PanelLeftOpen className="size-5" />
              )}
            </FloatItem>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default memo(FloatButtons);
