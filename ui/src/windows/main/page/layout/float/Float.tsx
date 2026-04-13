import { FC, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronUp, LocateFixed, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";
import { RoutePathConstants } from "@mahiru/ui/windows/main/constants";

import FloatItem from "./FloatItem";
import { cx } from "@emotion/css";

const Float: FC<{ className?: string }> = ({ className }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { layout, updateLayout } = useLayoutStore();

  // 在首页或根路径时不显示返回按钮
  const hiddenBack = !(
    RoutePathConstants.match(location, RoutePathConstants.home) ||
    RoutePathConstants.match(location, RoutePathConstants.base)
  );

  return (
    <div
      className={cx(
        `
        w-10 absolute right-6 bottom-24
        flex flex-col gap-2 justify-center items-center
        ease-in-out duration-300 transition-all
    `,
        className
      )}>
      <AnimatePresence mode="sync">
        {!layout.playModal && layout.scrollTop() && (
          <FloatItem key="scrollTop" onClick={layout.scrollTop() || undefined}>
            <ChevronUp className="size-5" />
          </FloatItem>
        )}
        {!layout.playModal && layout.fastLocator() && (
          <FloatItem key="locate" onClick={layout.fastLocator() || undefined}>
            <LocateFixed className="size-5" />
          </FloatItem>
        )}
        {!layout.playModal && hiddenBack && (
          <FloatItem key="back" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-5" />
          </FloatItem>
        )}
        {!layout.playModal && (
          <FloatItem
            key="sidebar"
            onClick={() => {
              updateLayout(layout.copy().setSideBar(!layout.sideBar));
            }}>
            {layout.sideBar ? (
              <PanelLeftClose className="size-5" />
            ) : (
              <PanelLeftOpen className="size-5" />
            )}
          </FloatItem>
        )}
      </AnimatePresence>
    </div>
  );
};
export default memo(Float);
