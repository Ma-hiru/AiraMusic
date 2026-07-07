import { cx } from "@emotion/css";
import { type LucideIcon } from "lucide-react";
import { memo, type FC, type ReactNode } from "react";

import Section from "../section";

interface CardProps {
  title?: string;
  Icon?: LucideIcon;
  subTitle?: string;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
  onClick?: NormalFunc;
}

const Card: FC<CardProps> = ({ className, onClick, Icon, title, action, children, subTitle }) => {
  return (
    <Section
      className={cx("surface-1 rounded-lg p-3", className)}
      Icon={Icon}
      title={title}
      action={action}
      children={children}
      subTitle={subTitle}
      onClick={onClick}
    />
  );
};

export default memo(Card);
