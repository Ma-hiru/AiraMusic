import { FC, memo } from "react";
import { cx } from "@emotion/css";
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
        "mr-[1px] max-w-max text-left text-[12px] font-semibold select-none",
        total < 100 && "min-w-[16px]",
        total >= 100 && "min-w-[24px]",
        total >= 1000 && "min-w-[32px]"
      )}
      onClick={() => {
        if (disabled) return;
        onClick?.();
      }}>
      {active ? <AudioLines className="size-[14px]" /> : (index + 1).toString().padStart(2, "0")}
    </span>
  );
};
export default memo(TrackItemIndex);
