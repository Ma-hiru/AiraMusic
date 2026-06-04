import { type FC, memo, type ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
}

const Tooltip: FC<TooltipProps> = ({ content, children }) => {
  return <section>{children}</section>;
};

export default memo(Tooltip);
