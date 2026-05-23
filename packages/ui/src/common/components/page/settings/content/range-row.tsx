import { type FC, memo } from "react";

interface RangeRowProps {
  title: string;
  value: string;
  min: number;
  max: number;
  step: number;
  rangeValue: number;
  onChange: NormalFunc<[value: number]>;
}

const RangeRow: FC<RangeRowProps> = ({ title, value, min, max, step, rangeValue, onChange }) => {
  return (
    <div className="py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-black tracking-normal  ">{title}</h3>
        <span className="rounded-md  px-2 py-1 text-[11px] font-black  ">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rangeValue}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        className="h-2 w-full cursor-pointer accent-(--theme-color-main)"
      />
      <div className="mt-1 flex items-center justify-between text-[10px] font-bold ">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export default memo(RangeRow);
