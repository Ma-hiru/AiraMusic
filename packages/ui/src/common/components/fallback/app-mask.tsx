import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, useRef, useState } from "react";

interface MaskProps {
  className?: string;
  show?: boolean;
}

const AppMask: FC<MaskProps> = ({ className, show = true }) => {
  const [visible, setVisible] = useState(show);
  const maskRef = useRef<HTMLDivElement>(null);

  const hidden = useCallback(() => {
    const mask = maskRef.current;
    if (!mask) return;
    mask.classList.add("opacity-0");
    setTimeout(() => setVisible(false), 1000);
  }, []);

  useEffect(() => {
    if (show) {
      setVisible(true);
    } else {
      hidden();
    }
  }, [hidden, show]);

  if (!visible) return null;
  return (
    <div
      ref={maskRef}
      className={cx(
        `
          w-screen h-screen fixed flex justify-center
          items-center flex-col gap-4 top-0 text-center
          ease-in-out duration-500 transition-opacity
        `,
        className
      )}>
      <img src="/images/logo.svg" alt="logo" className="size-16" />
      <p className="text-lg font-bold">{import.meta.env.APP_NAME}</p>
    </div>
  );
};

export default memo(AppMask);
