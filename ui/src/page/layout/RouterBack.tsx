import { FC, memo } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLayout } from "@mahiru/ui/ctx/LayoutCtx";

const RouterBack: FC<object> = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { PlayerModalVisible } = useLayout();
  const handleBack = () => {
    navigate(-1);
  };

  // 在首页或根路径时不显示返回按钮
  if (location.pathname === "/" || location.pathname === "/home" || PlayerModalVisible) {
    return null;
  }

  return (
    <div
      onClick={handleBack}
      className="absolute right-10 bottom-24 cursor-pointer z-30 bg-white/50 backdrop-blur-sm rounded-full p-1 hover:bg-white/70 transition-colors">
      <ChevronLeft className="size-5" />
    </div>
  );
};
export default memo(RouterBack);
