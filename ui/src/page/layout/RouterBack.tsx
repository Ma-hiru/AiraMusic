import { FC, memo } from "react";
import { ChevronLeft, ChevronUp, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { useLayoutStatus } from "@mahiru/ui/store";

const RouterBack: FC<object> = () => {
  const { canScrollTop, playerModalVisible, sideBarOpen, toggleSideBarOpen } = useLayoutStatus([
    "canScrollTop",
    "playerModalVisible",
    "sideBarOpen",
    "toggleSideBarOpen"
  ]);

  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    navigate(-1);
  };

  // 在首页或根路径时不显示返回按钮
  const hiddenBack = !(location.pathname === "/" || location.pathname === "/home");

  return (
    <div
      className={cx(
        "absolute right-10 bottom-24 z-30 flex justify-center items-center flex-col w-10 gap-2",
        playerModalVisible && "hidden"
      )}>
      {canScrollTop.type !== "none" && (
        <div
          onClick={canScrollTop.callback}
          className="cursor-pointer bg-white/50 backdrop-blur-sm rounded-full p-1 hover:bg-white/70 transition-colors">
          <ChevronUp className="size-5" />
        </div>
      )}
      {hiddenBack && (
        <div
          onClick={handleBack}
          className="cursor-pointer bg-white/50 backdrop-blur-sm rounded-full p-1 hover:bg-white/70 transition-colors">
          <ChevronLeft className="size-5" />
        </div>
      )}
      <div className="cursor-pointer bg-white/50 backdrop-blur-sm rounded-full p-1 hover:bg-white/70 transition-colors">
        {sideBarOpen && (
          <PanelLeftClose
            className="size-5 cursor-pointer active:scale-90"
            onClick={toggleSideBarOpen}
          />
        )}
        {!sideBarOpen && (
          <PanelLeftOpen
            className="size-5 cursor-pointer active:scale-90"
            onClick={toggleSideBarOpen}
          />
        )}
      </div>
    </div>
  );
};
export default memo(RouterBack);
