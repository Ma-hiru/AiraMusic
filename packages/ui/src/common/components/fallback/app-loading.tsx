import { cx } from "@emotion/css";
import { memo, type FC, type ReactNode, type RefObject } from "react";

import Loading from "./loading";

interface ListLoadingProps {
  ref?: RefObject<Nullable<HTMLDivElement>>;
  tips?: string;
  wrap?: boolean;
  loading: boolean;
  className?: string;
  smallIcon?: boolean;
  children?: ReactNode;
}

const AppLoading: FC<ListLoadingProps> = ({
  ref,
  className,
  wrap,
  loading,
  children,
  tips = "数据努力加载中",
  smallIcon = false
}) => {
  if (!loading) {
    if (wrap) return <div ref={ref}>{children}</div>;
    return children;
  }
  return (
    <div
      ref={ref}
      className={cx(
        "px-2 py-1 w-full h-full flex flex-col gap-2 justify-center items-center text-center",
        className
      )}>
      <Loading className={smallIcon ? "size-3" : "size-8"} />
      <span className="font-semibold">{tips}</span>
    </div>
  );
};

export default memo(AppLoading);
