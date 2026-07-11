import { memo, type FC } from "react";

interface MiniStatProps {
  label: string;
  value: Optional<number | string>;
}

const MiniStat: FC<MiniStatProps> = ({ label, value }) => {
  if (value == null) return null;
  return (
    <div className="rounded-md border border-white/30 px-2 py-2" title={String(value)}>
      <p className="truncate text-[10px] font-bold">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
};

export default memo(MiniStat);
