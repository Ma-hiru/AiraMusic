import Color from "color";
import { FC, memo, ReactNode } from "react";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

interface TitleProps {
  title: ReactNode;
  slot?: ReactNode;
}

const Title: FC<TitleProps> = ({ title, slot }) => {
  const { mainColor } = useThemeColor();
  return (
    <div
      className="w-full truncate font-bold text-[28px] py-2 flex justify-between items-center select-none"
      style={{ color: Color("#000000").mix(Color(mainColor), 0.2).string() }}>
      <span>{title}</span>
      <span>{slot}</span>
    </div>
  );
};
export default memo(Title);
