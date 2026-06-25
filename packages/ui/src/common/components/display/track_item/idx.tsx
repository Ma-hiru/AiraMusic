import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { AudioLines, Check } from "lucide-react";

interface ListItemIndexProps {
  index: number;
  total: number;
  active: boolean;
  disabled: boolean;
  onClick?: NormalFunc;
  selectionMode?: boolean;
  selected?: boolean;
}

const TrackItemIndex: FC<ListItemIndexProps> = ({
  index,
  total,
  active,
  onClick,
  disabled,
  selectionMode,
  selected
}) => {
  const widthClass = cx(
    total < 100 && "min-w-4",
    total >= 100 && "min-w-6",
    total >= 1000 && "min-w-8"
  );

  if (selectionMode) {
    return (
      <span className={cx("mr-px flex select-none items-center justify-start", widthClass)}>
        <span
          className={cx(
            "flex size-4 items-center justify-center rounded border transition-colors duration-200",
            selected ? "border-primary bg-primary text-(--text-color-on-main)" : "border-current/40"
          )}>
          {selected && <Check className="size-3" />}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cx("mr-px max-w-max text-left text-[12px] font-semibold select-none", widthClass)}
      onClick={() => !disabled && onClick?.()}>
      {active ? <AudioLines className="size-3.5" /> : (index + 1).toString().padStart(2, "0")}
    </span>
  );
};
export default memo(TrackItemIndex);
