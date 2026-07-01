import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, type FC } from "react";
import { playModalAtom } from "@/wins/main/atoms/layout";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";

import PlayerPage from "../player";

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
      <AppErrorBoundary className="h-full w-full" name="PlayerModal" canReset showError>
        <PlayerPage />
      </AppErrorBoundary>
    </div>
  );
};

export default memo(Modal);
