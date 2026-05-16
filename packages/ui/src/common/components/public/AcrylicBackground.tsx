import { FC, memo, useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@emotion/css";

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
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (src !== current) {
      setNext(src);
      setStage("idle");
      if (timerRef.current) clearTimeout(timerRef.current);
    }
  }, [current, src]);

  // 组件卸载时清理定时器，避免内存泄漏
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleLoad = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStage("fade");
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          setCurrent(next);
          setNext(undefined);
          setStage("idle");
        }, duration);
      });
    });
  }, [duration, next]);

  const imgClasses = "absolute inset-0 w-full h-full object-cover scale-110";

  return (
    <div className={cx("relative w-full h-full overflow-hidden", className)}>
      {/* 当前背景（淡出层） */}
      <img
        key={current}
        src={current}
        loading="lazy"
        decoding="async"
        alt={alt}
        className={imgClasses}
        style={{
          transition: `opacity ${duration}ms ease`,
          opacity: next ? 0 : opacity,
          filter: `blur(${blur}px) brightness(${brightness})`
        }}
      />
      {/* 下一张（淡入层） */}
      {next && (
        <img
          src={next}
          key={next}
          alt="preload"
          onLoad={handleLoad}
          className={imgClasses}
          style={{
            transition: `opacity ${duration}ms ease, filter ${duration}ms ease`,
            opacity: stage === "fade" ? opacity : 0,
            filter: `blur(${stage === "fade" ? blur : blur * 2}px) brightness(${brightness})`
          }}
        />
      )}
      {/* 毛玻璃层 */}
      <div
        className="absolute inset-0"
        style={{
          backdropFilter: `blur(${blur * 0.8}px) saturate(180%)`,
          WebkitBackdropFilter: `blur(${blur * 0.8}px) saturate(180%)`,
          background: "rgba(255, 255, 255, 0.05)"
        }}
      />
    </div>
  );
};

export default memo(AcrylicBackground);
