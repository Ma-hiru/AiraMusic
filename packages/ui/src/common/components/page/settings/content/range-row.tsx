import { type FC, memo, useEffect, useMemo, useState } from "react";
import { debounce } from "lodash-es";
import type { LucideIcon } from "lucide-react";

import BaseItem from "./base-item";
import RangeSlider from "@/common/components/data-input/range";

interface RangeRowProps {
  title: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  step: number;
  debounced?: boolean;
  onChange: NormalFunc<[value: number]>;
  icon?: LucideIcon;
}

const RangeRow: FC<RangeRowProps> = ({
  title,
  value,
  min,
  max,
  step,
  onChange,
  icon,
  unit,
  debounced = true
}) => {
  const [rangeValue, setRangeValue] = useState(value);
  const debouncedHandler = useMemo(() => {
    if (debounced) return debounce(onChange, 300);
    return onChange;
  }, [debounced, onChange]);

  useEffect(() => setRangeValue(value), [value]);

  return (
    <BaseItem
      icon={icon}
      children={
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black tracking-normal">{title}</h3>
            <span className="rounded-md px-2 py-1 text-[11px] font-black">
              {rangeValue} {unit}
            </span>
          </div>
          <RangeSlider
            min={min}
            max={max}
            step={step}
            value={rangeValue}
            className="w-[98%]!"
            onChange={(v) => {
              setRangeValue(v);
              debouncedHandler(v);
            }}
          />
          <div className="flex items-center justify-between text-[10px] font-bold mt-1 opacity-50">
            <span>
              {min} {unit}
            </span>
            <span>
              {max} {unit}
            </span>
          </div>
        </>
      }
    />
  );
};

export default memo(RangeRow);
