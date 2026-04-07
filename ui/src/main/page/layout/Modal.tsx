import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import PlayerPage from "@mahiru/ui/main/page/player/PlayerPage";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";

const Modal: FC<{ className?: string }> = ({ className }) => {
  const { layout } = useLayoutStore();

  return (
    <div
      className={cx(
        `
          fixed inset-0 overflow-hidden bg-gray-600
          duration-400 ease-in-out transform transition-transform contain-content
        `,
        layout.playModal ? "translate-y-0" : "translate-y-full",
        className
      )}>
      <AppErrorBoundary name="PlayerModal" showError canReset className="h-full w-full">
        <PlayerPage />
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Modal);
