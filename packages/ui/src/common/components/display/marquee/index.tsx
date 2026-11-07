import { cx } from "@emotion/css";
import { memo, useRef, type FC, createElement, type ReactNode } from "react";
import { useMarquee, type MarqueeOpts } from "@/common/hooks/use-marquee";

type MarqueeTag = "p" | "h1" | "h2" | "h3" | "h4" | "div" | "span";

interface MarqueeProps {
  text?: string;
  /** 渲染的标签，默认为 h1 */
  as?: MarqueeTag;
  className?: string;
  children?: ReactNode;
  options?: MarqueeOpts;
  itemClassName?: string;
}

const DEFAULT_OPTIONS: MarqueeOpts = {
  pingPong: true,
  pauseOnHover: true,
  gapDuration: 3000,
  speed: 10
};

const Marquee: FC<MarqueeProps> = ({
  className,
  text,
  options,
  children,
  as = "h1",
  itemClassName
}) => {
  const titleRef = useRef<Nullable<HTMLElement>>(null);
  useMarquee(titleRef, {
    ...(options ?? DEFAULT_OPTIONS),
    disable: options?.disable || (!text && !children)
  });
  if (!text && !children) return;
  return createElement(
    as,
    {
      ref: titleRef,
      className: cx("truncate overflow-hidden max-w-full", className),
      title: text
    },
    <span className={cx("inline-block", itemClassName)}>
      {text}
      {children}
    </span>
  );
};

export default memo(Marquee);
