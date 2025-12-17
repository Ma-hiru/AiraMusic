import { FC, memo, useCallback, useEffect, useState } from "react";
import { css, cx } from "@emotion/css";

interface AcrylicBackgroundProps {
  src?: string;
  alt?: string;
  blur?: number;
  opacity?: number;
  className?: string;
  brightness?: number;
  duration?: number;
}

const AcrylicBackground: FC<AcrylicBackgroundProps> = ({
  src,
  blur = 40,
  opacity = 0.35,
  alt,
  className,
  brightness = 0.5,
  duration = 800
}) => {
  const [current, setCurrent] = useState(src);
  const [next, setNext] = useState<string>();
  const [stage, setStage] = useState<"idle" | "fade">("idle");

  useEffect(() => {
    if (src !== current) {
      setNext(src);
      setStage("idle");
    }
  }, [current, src]);

  const handleLoad = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStage("fade");
        setTimeout(() => {
          setCurrent(next);
          setNext(undefined);
          setStage("idle");
        }, duration);
      });
    });
  }, [duration, next]);

  return (
    <div className={cx("relative w-full h-full overflow-hidden", className)}>
      {/* 当前背景（淡出层） */}
      <img
        key={current}
        src={current}
        loading="lazy"
        decoding="async"
        alt={alt}
        className={css`
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scale(1.1);
          transition: opacity ${duration}ms ease;
          opacity: ${next ? 0 : opacity};
          filter: blur(${blur}px) brightness(${brightness});
        `}
      />
      {/* 下一张（淡入层） */}
      {next && (
        <img
          src={next}
          key={next}
          alt="preload"
          onLoad={handleLoad}
          className={css`
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transform: scale(1.1);
            transition:
              opacity ${duration}ms ease,
              filter ${duration}ms ease;
            opacity: ${stage === "fade" ? opacity : 0};
            filter: blur(${stage === "fade" ? blur : blur * 2}px) brightness(${brightness});
          `}
        />
      )}
      {/* 毛玻璃层 */}
      <div
        className={css`
          position: absolute;
          inset: 0;
          backdrop-filter: blur(${blur * 0.8}px) saturate(180%);
          background: rgba(255, 255, 255, 0.05);
        `}
      />
    </div>
  );
};
export default memo(AcrylicBackground);
