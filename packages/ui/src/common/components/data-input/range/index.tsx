import { cx } from "@emotion/css";
import { clamp } from "lodash-es";
import {
  memo,
  useRef,
  type FC,
  useCallback,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from "react";

interface RangeSliderProps {
  max: number;
  min: number;
  step: number;
  value: number;
  label?: string;
  className?: string;
  valueText?: string;
  style?: CSSProperties;
  colorReverse?: boolean;
  orientation?: "vertical" | "horizontal";
  onChange: NormalFunc<[value: number]>;
}

function stepPrecision(step: number) {
  const [, decimal = ""] = String(step).split(".");
  return decimal.length;
}

const RangeSlider: FC<RangeSliderProps> = ({
  className,
  onChange,
  max,
  min,
  step,
  style,
  value,
  valueText,
  label = "范围滑块",
  colorReverse = false,
  orientation = "horizontal"
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const normalizeValue = useCallback(
    (raw: number) => {
      const stepped = min + Math.round((raw - min) / step) * step;
      return clamp(Number(stepped.toFixed(stepPrecision(step))), min, max);
    },
    [max, min, step]
  );
  const currentValue = normalizeValue(value);
  const percentage = max === min ? 0 : ((currentValue - min) / (max - min)) * 100;

  // 计算滑动位置对应百分比
  const calcValue = useCallback(
    (clientX: number, clientY: number) => {
      const track = trackRef.current;
      if (!track) return currentValue;
      const { left, width, bottom, height } = track.getBoundingClientRect();
      const ratio =
        orientation === "vertical"
          ? clamp((bottom - clientY) / height, 0, 1)
          : clamp((clientX - left) / width, 0, 1);
      const raw = ratio * (max - min) + min;
      return normalizeValue(raw);
    },
    [currentValue, max, min, normalizeValue, orientation]
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      trackRef.current?.focus({ preventScroll: true });
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

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      const pageStep = step * 10;
      let nextValue: Nullable<number> = null;

      switch (e.key) {
        case "ArrowRight":
        case "ArrowUp":
          nextValue = currentValue + step;
          break;
        case "ArrowLeft":
        case "ArrowDown":
          nextValue = currentValue - step;
          break;
        case "PageUp":
          nextValue = currentValue + pageStep;
          break;
        case "PageDown":
          nextValue = currentValue - pageStep;
          break;
        case "Home":
          nextValue = min;
          break;
        case "End":
          nextValue = max;
          break;
      }

      if (nextValue === null) return;
      e.preventDefault();
      onChange(normalizeValue(nextValue));
    },
    [currentValue, max, min, normalizeValue, onChange, step]
  );

  return (
    <div
      ref={trackRef}
      className={cx(
        "relative cursor-pointer rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        orientation === "vertical" ? "h-full w-1.5" : "h-1.5 w-full",
        colorReverse ? "bg-(--text-color-on-main)/15" : "bg-primary/15",
        className
      )}
      style={style}
      tabIndex={0}
      role="slider"
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuetext={valueText}
      aria-valuenow={currentValue}
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      onMouseDown={handleMouseDown}>
      <div
        className={cx(
          "absolute rounded-full",
          orientation === "vertical" ? "bottom-0 left-0 w-full" : "left-0 top-0 h-full",
          colorReverse ? "bg-primary-text" : "bg-primary"
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
          colorReverse ? "bg-primary-text" : "bg-primary"
        )}
        style={
          orientation === "vertical"
            ? { left: "50%", top: `${100 - percentage}%` }
            : { left: `${percentage}%`, top: "50%" }
        }
        title={valueText ?? String(currentValue)}
      />
    </div>
  );
};

export default memo(RangeSlider);
