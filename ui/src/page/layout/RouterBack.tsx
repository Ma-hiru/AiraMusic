import { FC, memo } from "react";
import { ChevronLeft, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const RouterBack: FC<object> = () => {
  const { playerModalVisible, sideBarOpen, toggleSideBarOpen } = useLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const handleBack = () => {
    navigate(-1);
  };

  // 在首页或根路径时不显示返回按钮
  const showBack = location.pathname === "/" || location.pathname === "/home" || playerModalVisible;

  return (
    <div className="absolute right-10 bottom-24 z-30 flex justify-center items-center flex-col w-10 gap-2">
      {!showBack && (
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
