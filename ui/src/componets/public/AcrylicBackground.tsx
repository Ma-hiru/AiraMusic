import { FC, memo } from "react";
import { css, cx } from "@emotion/css";

interface AcrylicBackgroundProps {
  src?: string;
  alt?: string;
  blur?: number;
  opacity?: number;
  className?: string;
  brightness?: number;
}

const AcrylicBackground: FC<AcrylicBackgroundProps> = ({
  src,
  blur = 40,
  opacity = 0.35,
  alt,
  className,
  brightness = 0.5
}) => {
  return (
    <div className={cx("relative w-full h-full overflow-hidden", className)}>
      {/* Blurred background */}
      <img
        src={src}
        loading="lazy"
        alt={alt}
        className={css`
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: blur(${blur}px) brightness(${brightness});
          transform: scale(1.1);
        `}
        style={{ opacity }}
      />
      {/* Frosted overlay layer */}
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
