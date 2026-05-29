import { type FC, memo, useCallback, useRef, type MouseEvent as ReactMouseEvent } from "react";
import { clamp } from "lodash-es";

interface RangeSliderProps {
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: NormalFunc<[value: number]>;
}

const RangeSlider: FC<RangeSliderProps> = ({ min, max, step, value, onChange }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const percentage = ((value - min) / (max - min)) * 100;

  // 计算滑动位置对应百分比
  const calcValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const { left, width } = track.getBoundingClientRect();
      const ratio = clamp((clientX - left) / width, 0, 1);
      const raw = ratio * (max - min) + min;
      return Math.round(raw / step) * step;
    },
    [min, max, step, value]
  );

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      onChange(calcValue(e.clientX));

      const handleMouseMove = (e: MouseEvent) => onChange(calcValue(e.clientX));
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
      className="relative h-1.5 w-full cursor-pointer rounded-full bg-white/15"
      onMouseDown={handleMouseDown}>
      <div
        className="absolute left-0 top-0 h-full rounded-full bg-(--theme-color-main)"
        style={{ width: `${percentage}%` }}
      />
      <div
        className={`
          absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2
          cursor-pointer rounded-full bg-(--theme-color-main)
          shadow-md hover:scale-110
          transition-transform ease-in-out duration-300
        `}
        style={{ left: `${percentage}%` }}
      />
    </div>
  );
};

export default memo(RangeSlider);
