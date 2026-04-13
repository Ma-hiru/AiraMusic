import Color from "color";
import { FC, memo, ReactNode } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { cx } from "@emotion/css";

interface TitleProps {
  title: ReactNode;
  className?: string;
  slot?: ReactNode;
}

const Title: FC<TitleProps> = ({ title, slot, className }) => {
  const { mainColor } = useThemeColor();
  return (
    <div
      className={cx(
        `
          w-full truncate font-bold text-[28px]
          flex justify-between items-center select-none
       `,
        className
      )}
      style={{ color: Color("#000000").mix(Color(mainColor), 0.2).string() }}>
      <span>{title}</span>
      <span>{slot}</span>
    </div>
  );
};
export default memo(Title);
