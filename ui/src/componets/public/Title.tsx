import { FC, memo, ReactNode } from "react";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import Color from "color";

interface TitleProps {
  title: ReactNode;
  slot?: ReactNode;
}

const Title: FC<TitleProps> = ({ title, slot }) => {
  const { mainColor } = useThemeColor();
  return (
    <div
      className="w-full truncate font-bold text-[28px] py-2 flex justify-between items-center"
      style={{ color: Color("#000000").mix(Color(mainColor), 0.5).string() }}>
      <span>{title}</span>
      <span>{slot}</span>
    </div>
  );
};
export default memo(Title);
