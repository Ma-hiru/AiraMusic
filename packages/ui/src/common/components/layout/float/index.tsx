import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { ChevronLeft, ChevronUp, LocateFixed, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { AnimatePresence } from "motion/react";

import FloatItem from "./float-item";

interface FloatProps {
  className?: string;
  hidden?: boolean;
  /** 回到顶部 */
  scrollTop?: Optional<NormalFunc>;
  /** 定位到当前播放曲目 */
  fastLocate?: Optional<NormalFunc>;
  /** 返回上一页 */
  onBack?: Optional<NormalFunc>;
  /** 侧栏开关 */
  sidebar?: Optional<{ open: boolean; toggle: NormalFunc }>;
}

const Float: FC<FloatProps> = ({ className, hidden, scrollTop, fastLocate, onBack, sidebar }) => {
  return (
    <div
      className={cx(
        `
        w-10 absolute
        flex flex-col gap-2 justify-center items-center
        ease-in-out duration-300 transition-all
      `,
        className
      )}>
      <AnimatePresence mode="sync">
        {!hidden && scrollTop && (
          <FloatItem key="scrollTop" motionKey="scrollTop" onClick={scrollTop}>
            <ChevronUp className="size-5" />
          </FloatItem>
        )}
        {!hidden && fastLocate && (
          <FloatItem key="locate" motionKey="locate" onClick={fastLocate}>
            <LocateFixed className="size-5" />
          </FloatItem>
        )}
        {!hidden && onBack && (
          <FloatItem key="back" motionKey="back" onClick={onBack}>
            <ChevronLeft className="size-5" />
          </FloatItem>
        )}
        {!hidden && sidebar && (
          <FloatItem key="sidebar" motionKey="sidebar" onClick={sidebar.toggle}>
            {sidebar.open ? (
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
