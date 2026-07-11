import { cx } from "@emotion/css";
import { memo, useRef, type FC, type ReactNode } from "react";
import { useMarquee, type MarqueeOpts } from "@/common/hooks/use-marquee";

interface MarqueeProps {
  text?: string;
  className?: string;
  children?: ReactNode;
  options?: MarqueeOpts;
  itemClassName?: string;
}

const Marquee: FC<MarqueeProps> = ({ className, text, options, children, itemClassName }) => {
  const titleRef = useRef(null);
  useMarquee(
    titleRef,
    options ?? {
      pingPong: true,
      pauseOnHover: true,
      gapDuration: 3000,
      speed: 10
    }
  );
  if (!text && !children) return;
  return (
    <h1
      ref={titleRef}
      className={cx("truncate overflow-hidden max-w-full", className)}
      title={text}>
      <span className={cx("inline-block", itemClassName)}>
        {text}
        {children}
      </span>
    </h1>
  );
};

export default memo(Marquee);
