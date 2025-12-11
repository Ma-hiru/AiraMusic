import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { AudioLines } from "lucide-react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface ListItemIndexProps {
  relativeIndex: number;
  total: number;
  active: boolean;
  onClick?: NormalFunc;
}

const ListItemIndex: FC<ListItemIndexProps> = ({ relativeIndex, total, active, onClick }) => {
  const { textColorOnMain } = useThemeColor();
  const color = textColorOnMain.alpha(0.8).string();
  return (
    <span
      style={{ color }}
      className={cx("mr-[1px] max-w-max text-left text-[12px] font-semibold select-none", {
        "min-w-[16px]": total < 100,
        "min-w-[24px]": total >= 100,
        "min-w-[32px]": total >= 1000
      })}
      onClick={onClick}>
      {active ? (
        <AudioLines className="size-[14px]" />
      ) : (
        (relativeIndex + 1).toString().padStart(2, "0")
      )}
    </span>
  );
};
export default memo(ListItemIndex);
