import { type FC, memo } from "react";
import { cx } from "@emotion/css";

import KeepAliveOutlet from "../../../../common/components/public/keep-alive-outlet";
import AppErrorBoundary from "../../../../common/components/fallback/app-error-boundary";

const Content: FC<object> = () => {
  return (
    <div
      className={cx(
        `
            relative flex-1 pb-(--playbar-height) pt-(--top-control-height)
            ease-in-out duration-300 transition-all
            contain-strict
          `
      )}>
      <AppErrorBoundary name="Content" showError canReset className="h-full w-full">
        <KeepAliveOutlet maxCache={3} />
      </AppErrorBoundary>
    </div>
  );
};
export default memo(Content);
