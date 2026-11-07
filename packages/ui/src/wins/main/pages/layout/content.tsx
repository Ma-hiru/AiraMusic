import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import KeepAliveOutlet from "@/common/components/other/keep-alive-outlet";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";

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
      <div className="mx-auto h-full w-full max-w-(--content-max-width)">
        <AppErrorBoundary className="h-full w-full" name="Content" showError={false} canReset>
          <KeepAliveOutlet maxCache={5} />
        </AppErrorBoundary>
      </div>
    </div>
  );
};
export default memo(Content);
