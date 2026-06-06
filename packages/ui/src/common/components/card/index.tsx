import { type FC, memo, type ReactNode } from "react";
import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";
import HomeSection from "@/wins/main/componets/home-section";

interface CardProps {
  title?: string;
  subTitle?: string;
  Icon?: LucideIcon;
  className?: string;
  children?: ReactNode;
  onClick?: NormalFunc;
}

const Card: FC<CardProps> = ({ title, subTitle, Icon, children, className, onClick }) => {
  return (
    <HomeSection
      onClick={onClick}
      className={cx(
        `
        rounded-lg border border-white/20 p-3 bg-white/5
        shadow-md backdrop-blur-2xl
      `,
        className
      )}
      title={title}
      subTitle={subTitle}
      Icon={Icon}
      children={children}
    />
  );
};

export default memo(Card);
