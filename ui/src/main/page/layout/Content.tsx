import { FC, memo } from "react";
import { cx } from "@emotion/css";

import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";

const Content: FC<object> = () => {
  return (
    <div
      className={cx(
        `
            relative flex-1 pb-18 pt-10
            ease-in-out duration-300 transition-all
          `
      )}>
      <AppErrorBoundary name="Content" showError canReset className="h-full w-full">
        <KeepAliveOutlet maxCache={3} />
      </AppErrorBoundary>
    </div>
  );
};
export default memo(Content);
