import { type FC, memo } from "react";
import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { playModalAtom } from "@mahiru/ui/windows/main/atoms/layout";

import PlayerPage from "@mahiru/ui/windows/main/page/player/PlayerPage";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";

const Modal: FC<{ className?: string }> = ({ className }) => {
  const playModal = useAtomValue(playModalAtom);

  return (
    <div
      className={cx(
        `
          fixed inset-0 overflow-hidden bg-gray-600
          duration-400 ease-in-out transform transition-transform contain-content
        `,
        playModal ? "translate-y-0" : "translate-y-full",
        className
      )}>
      <AppErrorBoundary name="PlayerModal" showError canReset className="h-full w-full">
        <PlayerPage />
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Modal);
