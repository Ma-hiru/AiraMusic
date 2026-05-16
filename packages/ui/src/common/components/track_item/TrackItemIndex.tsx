import { cx } from "@emotion/css";
import { FC, memo } from "react";
import { AudioLines } from "lucide-react";

interface ListItemIndexProps {
  index: number;
  total: number;
  active: boolean;
  color: string;
  disabled: boolean;
  onClick?: NormalFunc;
}

const TrackItemIndex: FC<ListItemIndexProps> = ({
  index,
  total,
  active,
  onClick,
  color,
  disabled
}) => {
  return (
    <span
      style={{ color }}
      className={cx(
        "mr-px max-w-max text-left text-[12px] font-semibold select-none",
        total < 100 && "min-w-4",
        total >= 100 && "min-w-6",
        total >= 1000 && "min-w-8"
      )}
      onClick={() => !disabled && onClick?.()}>
      {active ? <AudioLines className="size-3.5" /> : (index + 1).toString().padStart(2, "0")}
    </span>
  );
};
export default memo(TrackItemIndex);
