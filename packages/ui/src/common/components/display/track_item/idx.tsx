import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { Check, AudioLines } from "lucide-react";

interface ListItemIndexProps {
  index: number;
  total: number;
  active: boolean;
  disabled: boolean;
  selected?: boolean;
  selectionMode?: boolean;
  onClick?: NormalFunc;
}

const TrackItemIndex: FC<ListItemIndexProps> = ({
  onClick,
  index,
  total,
  active,
  disabled,
  selected,
  selectionMode
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
            selected ? "border-primary bg-primary text-primary-text" : "border-current/40"
          )}>
          {selected && <Check className="size-3" />}
        </span>
      </span>
    );
  }

  return (
    <span
      className={cx(
        "mr-px flex max-w-max items-center text-left text-[12px] font-semibold tabular-nums opacity-75 select-none",
        widthClass
      )}
      onClick={() => !disabled && onClick?.()}>
      {active ? <AudioLines className="size-3.5" /> : (index + 1).toString().padStart(2, "0")}
    </span>
  );
};
export default memo(TrackItemIndex);
