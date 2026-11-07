import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import { DiscAlbum, ListMusic, UserRound, type LucideIcon } from "lucide-react";

import type { StarCategory } from "./types";

interface StarTabsProps {
  className?: string;
  active: StarCategory;
  onChange?: NormalFunc<[category: StarCategory]>;
}

const tabs: {
  label: string;
  Icon: LucideIcon;
  key: StarCategory;
}[] = [
  { key: "playlist", label: "歌单", Icon: ListMusic },
  { key: "album", label: "专辑", Icon: DiscAlbum },
  { key: "artist", label: "歌手", Icon: UserRound }
];

const StarTabs: FC<StarTabsProps> = ({ className, onChange, active }) => {
  return (
    <div
      className={cx("flex min-w-0 items-center gap-0.5 overflow-x-auto scrollbar-hide", className)}>
      {tabs.map(({ key, Icon, label }) => {
        const selected = key === active;

        return (
          <button
            key={key}
            className={cx(
              `
                flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full
                px-2 py-1.5 text-[12px] font-bold
                transition-all duration-300 ease-in-out active:scale-[0.98]
              `,
              selected ? "bg-primary text-primary-text" : "text-normal-text hover:bg-white/20"
            )}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange?.(key)}>
            <Icon className="size-3.5 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default memo(StarTabs);
