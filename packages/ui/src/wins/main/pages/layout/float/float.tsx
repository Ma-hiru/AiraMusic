import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronUp, LocateFixed, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { RoutePathMain } from "@/common/routes";
import { useAtom, useAtomValue } from "jotai";
import { playModalAtom, scrollActionsAtom, sidebarAtom } from "@/wins/main/atoms/layout";

import FloatItem from "./float-item";

const Float: FC<{ className?: string }> = ({ className }) => {
  const playModal = useAtomValue(playModalAtom);
  const scrollActions = useAtomValue(scrollActionsAtom);
  const [sidebar, setSidebar] = useAtom(sidebarAtom);
  const navigate = useNavigate();
  const location = useLocation();
  const scrollTop = scrollActions.scrollTop;
  const fastLocator = scrollActions.fastLocate;

  // 在首页或根路径时不显示返回按钮
  const hiddenBack = !(
    RoutePathMain.match(location, RoutePathMain.home) ||
    RoutePathMain.match(location, RoutePathMain.base)
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
        {!playModal && scrollTop && (
          <FloatItem key="scrollTop" onClick={scrollTop ?? undefined}>
            <ChevronUp className="size-5" />
          </FloatItem>
        )}
        {!playModal && fastLocator && (
          <FloatItem key="locate" onClick={fastLocator ?? undefined}>
            <LocateFixed className="size-5" />
          </FloatItem>
        )}
        {!playModal && hiddenBack && (
          <FloatItem key="back" onClick={() => navigate(-1)}>
            <ChevronLeft className="size-5" />
          </FloatItem>
        )}
        {!playModal && (
          <FloatItem key="sidebar" onClick={() => setSidebar(!sidebar)}>
            {sidebar ? <PanelLeftClose className="size-5" /> : <PanelLeftOpen className="size-5" />}
          </FloatItem>
        )}
      </AnimatePresence>
    </div>
  );
};
export default memo(Float);
