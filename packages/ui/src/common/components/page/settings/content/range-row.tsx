import { debounce } from "lodash-es";
import { memo, type FC, useMemo, useState, useEffect } from "react";
import RangeSlider from "@/common/components/data-input/range";
import type { LucideIcon } from "lucide-react";

import BaseItem from "./base-item";

interface RangeRowProps {
  max: number;
  min: number;
  step: number;
  title: string;
  unit?: string;
  value: number;
  icon?: LucideIcon;
  debounced?: boolean;
  onChange: NormalFunc<[value: number]>;
}

const RangeRow: FC<RangeRowProps> = ({
  onChange,
  max,
  min,
  icon,
  step,
  unit,
  title,
  value,
  debounced = true
}) => {
  const [rangeValue, setRangeValue] = useState(value);
  const debouncedHandler = useMemo(() => {
    if (debounced) return debounce(onChange, 300);
    return onChange;
  }, [debounced, onChange]);
  const rangeValueText = `${rangeValue}${unit ? ` ${unit}` : ""}`;

  useEffect(() => setRangeValue(value), [value]);

  return (
    <BaseItem
      icon={icon}
      children={
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-normal">{title}</h3>
            <span className="rounded-md px-2 py-1 text-[11px] font-semibold">
              {rangeValue} {unit}
            </span>
          </div>
          <RangeSlider
            className="w-[98%]!"
            max={max}
            min={min}
            step={step}
            label={title}
            value={rangeValue}
            valueText={rangeValueText}
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
