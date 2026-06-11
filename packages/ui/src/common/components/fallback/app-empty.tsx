import { cx } from "@emotion/css";
import { type FC, memo, type Ref } from "react";
import { ArchiveBoxXMarkIcon } from "@heroicons/react/24/outline";

interface AppEmptyProps {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  tips?: string;
}

const AppEmpty: FC<AppEmptyProps> = ({ ref, className, tips = "暂无数据" }) => {
  return (
    <div
      ref={ref}
      className={cx(
        "px-2 py-1 w-full h-full flex flex-col gap-2 justify-center items-center text-center",
        className
      )}>
      <ArchiveBoxXMarkIcon className="size-8" />
      <span className="font-semibold">{tips}</span>
    </div>
  );
};

export default memo(AppEmpty);
