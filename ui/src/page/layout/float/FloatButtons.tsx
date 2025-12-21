import { FC, memo } from "react";
import { useLayoutStatus } from "@mahiru/ui/store";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronUp, LocateFixed, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import FloatItem from "@mahiru/ui/page/layout/float/FloatItem";

const FloatButtons: FC<object> = () => {
  const { canScrollTop, playerModalVisible, sideBarOpen, toggleSideBarOpen, locateCurrentTrack } =
    useLayoutStatus([
      "canScrollTop",
      "playerModalVisible",
      "sideBarOpen",
      "toggleSideBarOpen",
      "locateCurrentTrack"
    ]);
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    navigate(-1);
  };

  // 在首页或根路径时不显示返回按钮
  const hiddenBack = !(location.pathname === "/" || location.pathname === "/home");

  return (
    <AnimatePresence>
      {!playerModalVisible && (
        <motion.div
          key="floatButtons"
          className="absolute right-10 bottom-24 z-30 flex justify-center items-center flex-col w-10 gap-2"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ease: "easeInOut", duration: 0.3 }}>
          <FloatItem
            onClick={canScrollTop.callback}
            show={canScrollTop.type !== "none" && !playerModalVisible}>
            <ChevronUp className="size-5" />
          </FloatItem>
          <FloatItem show={!!locateCurrentTrack} onClick={locateCurrentTrack?.()}>
            <LocateFixed className="size-5" />
          </FloatItem>
          <FloatItem show={hiddenBack && !playerModalVisible} onClick={handleBack}>
            <ChevronLeft className="size-5" />
          </FloatItem>
          <FloatItem onClick={toggleSideBarOpen} show={!playerModalVisible}>
            {sideBarOpen ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeftOpen className="size-5" />
            )}
          </FloatItem>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
export default memo(FloatButtons);
