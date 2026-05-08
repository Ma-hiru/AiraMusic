import { cx } from "@emotion/css";
import { FC, memo, Ref } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { ArchiveBoxXMarkIcon } from "@heroicons/react/24/outline";

interface AppEmptyProps {
  ref?: Ref<HTMLDivElement>;
  color?: string;
  className?: string;
  tips?: string;
}

const AppEmpty: FC<AppEmptyProps> = ({ ref, color, className, tips = "暂无数据" }) => {
  const { mainColor } = useThemeColor();
  return (
    <div
      ref={ref}
      style={{ color: color || mainColor.hex() }}
      className={cx(
        "px-2 py-1 w-full h-full flex flex-col gap-2 justify-center items-center",
        className
      )}>
      <ArchiveBoxXMarkIcon className="size-8" />
      <span className="font-semibold">{tips}</span>
    </div>
  );
};
export default memo(AppEmpty);
