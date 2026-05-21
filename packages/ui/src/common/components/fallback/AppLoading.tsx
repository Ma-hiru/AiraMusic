import Loading from "../../components/public/Loading";
import { type FC, memo, type ReactNode, type RefObject } from "react";
import { cx } from "@emotion/css";

interface ListLoadingProps {
  ref?: RefObject<Nullable<HTMLDivElement>>;
  loading: boolean;
  children?: ReactNode;
  className?: string;
  tips?: string;
  wrap?: boolean;
}

const AppLoading: FC<ListLoadingProps> = ({
  loading,
  children,
  className,
  tips = "数据努力加载中",
  ref,
  wrap
}) => {
  if (!loading) {
    if (wrap) return <div ref={ref}>{children}</div>;
    return children;
  }
  return (
    <div
      ref={ref}
      className={cx(
        "px-2 py-1 w-full h-full flex flex-col gap-2 justify-center items-center",
        className
      )}>
      <Loading className="size-8" />
      <span className="font-semibold">{tips}</span>
    </div>
  );
};

export default memo(AppLoading);
