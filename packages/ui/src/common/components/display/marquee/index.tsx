import { type FC, memo, type ReactNode, useRef } from "react";
import { cx } from "@emotion/css";
import { type MarqueeOpts, useMarquee } from "@/common/hooks/use-marquee";

interface MarqueeProps {
  className?: string;
  itemClassName?: string;
  text?: string;
  options?: MarqueeOpts;
  children?: ReactNode;
}

const Marquee: FC<MarqueeProps> = ({ className, text, itemClassName, options, children }) => {
  const titleRef = useRef(null);
  useMarquee(
    titleRef,
    options ?? {
      pingPong: true,
      pauseOnHover: true,
      gapDuration: 2000,
      speed: 15
    }
  );
  return (
    <h1
      ref={titleRef}
      title={text}
      className={cx("truncate overflow-hidden max-w-full", className)}>
      <span className={cx("inline-block", itemClassName)}>
        {text}
        {children}
      </span>
    </h1>
  );
};

export default memo(Marquee);
