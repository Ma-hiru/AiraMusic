import { type FC, memo, useMemo } from "react";
import { debounce } from "lodash-es";
import type { LucideIcon } from "lucide-react";

import BaseItem from "./base-item";

interface RangeRowProps {
  title: string;
  value: number | string;
  min: number;
  max: number;
  step: number;
  rangeValue: number;
  onChange: NormalFunc<[value: number]>;
  icon: LucideIcon;
}

const RangeRow: FC<RangeRowProps> = ({
  title,
  value,
  min,
  max,
  step,
  rangeValue,
  onChange,
  icon
}) => {
  const debouncedHandler = useMemo(() => debounce(onChange, 300), [onChange]);
  return (
    <BaseItem
      icon={icon}
      children={
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black tracking-normal  ">{title}</h3>
            <span className="rounded-md  px-2 py-1 text-[11px] font-black text-(--theme-color-main)">
              {value}
            </span>
          </div>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={rangeValue}
            onChange={(event) => debouncedHandler(Number(event.currentTarget.value))}
            className="h-2 w-full cursor-pointer accent-(--theme-color-main)"
          />
          <div className="flex items-center justify-between text-[10px] font-bold ">
            <span>{min}</span>
            <span>{max}</span>
          </div>
        </>
      }
    />
  );
};

export default memo(RangeRow);
