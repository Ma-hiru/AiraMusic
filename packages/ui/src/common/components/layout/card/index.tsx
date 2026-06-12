import { type FC, memo, type ReactNode } from "react";
import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";
import Section from "../section";

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
    <Section
      onClick={onClick}
      className={cx(
        `
        rounded-lg border border-white/20 p-3 bg-white/5
        shadow-md backdrop-saturate-150 backdrop-blur-lg
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
