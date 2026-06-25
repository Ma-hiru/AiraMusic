import {
  type CSSProperties,
  type FC,
  memo,
  type MouseEvent as ReactMouseEvent,
  useCallback,
  useRef
} from "react";
import { clamp } from "lodash-es";
import { cx } from "@emotion/css";

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: NormalFunc<[value: number]>;
  style?: CSSProperties;
  className?: string;
  orientation?: "horizontal" | "vertical";
  colorReverse?: boolean;
}

const RangeSlider: FC<RangeSliderProps> = ({
  min,
  max,
  step,
  value,
  onChange,
  style,
  className,
  orientation = "horizontal",
  colorReverse = false
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const percentage = ((value - min) / (max - min)) * 100;

  // 计算滑动位置对应百分比
  const calcValue = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const { bottom, height, left, width } = track.getBoundingClientRect();
      const ratio =
        orientation === "vertical"
          ? clamp((bottom - clientY) / height, 0, 1)
          : clamp((clientX - left) / width, 0, 1);
      const raw = ratio * (max - min) + min;
      return Math.round(raw / step) * step;
    },
    [min, max, orientation, step, value]
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      onChange(calcValue(e.clientX, e.clientY));

      const handleMouseMove = (e: MouseEvent) => onChange(calcValue(e.clientX, e.clientY));
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [calcValue, onChange]
  );

  return (
    <div
      ref={trackRef}
      style={style}
      className={cx(
        "relative cursor-pointer rounded-full",
        orientation === "vertical" ? "h-full w-1.5" : "h-1.5 w-full",
        colorReverse ? "bg-(--text-color-on-main)/15" : "bg-primary/15",
        className
      )}
      onMouseDown={handleMouseDown}>
      <div
        className={cx(
          "absolute rounded-full",
          orientation === "vertical" ? "bottom-0 left-0 w-full" : "left-0 top-0 h-full",
          colorReverse ? "bg-(--text-color-on-main)" : "bg-primary"
        )}
        style={
          orientation === "vertical" ? { height: `${percentage}%` } : { width: `${percentage}%` }
        }
      />
      <div
        className={cx(
          `
          absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2
          cursor-pointer rounded-full shadow-md hover:scale-110
          transition-transform ease-in-out duration-300
        `,
          colorReverse ? "bg-(--text-color-on-main)" : "bg-primary"
        )}
        title={String(value)}
        style={
          orientation === "vertical"
            ? { left: "50%", top: `${100 - percentage}%` }
            : { left: `${percentage}%`, top: "50%" }
        }
      />
    </div>
  );
};

export default memo(RangeSlider);
