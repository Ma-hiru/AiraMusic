import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { AudioLines } from "lucide-react";
import { getTextColorByBackgroundColor, readThemeColorByCSSVar } from "@mahiru/ui/utils/ui";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";

interface ListItemIndexProps {
  relativeIndex: number;
  total: number;
  active: boolean;
  onClick?: NormalFunc;
}

const ListItemIndex: FC<ListItemIndexProps> = ({ relativeIndex, total, active, onClick }) => {
  const textColor = useTextColorOnThemeColor();
  return (
    <span
      style={{ color: active ? textColor : undefined }}
      className={cx("mr-[1px] max-w-max text-left text-[12px] text-[#7b8290]/50 font-semibold", {
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
