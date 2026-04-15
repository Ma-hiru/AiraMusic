import Loading from "@mahiru/ui/public/components/public/Loading";
import { FC, memo, ReactNode } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { cx } from "@emotion/css";

interface ListLoadingProps {
  loading: boolean;
  color?: string;
  children?: ReactNode;
  className?: string;
  tips?: string;
}

const AppLoading: FC<ListLoadingProps> = ({
  loading,
  children,
  className,
  tips = "数据努力加载中",
  color
}) => {
  const { mainColor } = useThemeColor();
  if (!loading) return <>{children}</>;
  return (
    <div
      style={{ color: color || mainColor.hex() }}
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
