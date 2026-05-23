import { type FC, memo } from "react";

interface MiniStatProps {
  label: string;
  value: Optional<string | number>;
}

const MiniStat: FC<MiniStatProps> = ({ label, value }) => {
  if (value == null) return null;
  return (
    <div title={String(value)} className="rounded-md border border-white/30 px-2 py-2">
      <p className="truncate text-[10px] font-bold">{label}</p>
      <p className="mt-1 truncate text-sm font-black">{value}</p>
    </div>
  );
};

export default memo(MiniStat);
