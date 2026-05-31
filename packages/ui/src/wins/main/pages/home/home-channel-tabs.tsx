import { cx } from "@emotion/css";
import { type FC, memo } from "react";
import { HOME_CHANNELS, type HomeChannelKey } from "./home-config";

interface HomeChannelTabsProps {
  active: HomeChannelKey;
  onChange: NormalFunc<[key: HomeChannelKey]>;
}

const HomeChannelTabs: FC<HomeChannelTabsProps> = ({ active, onChange }) => {
  return (
    <div className="flex w-full gap-2 overflow-x-auto scrollbar-hide py-1">
      {HOME_CHANNELS.map(({ key, label, caption, Icon }) => {
        const selected = key === active;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={cx(
              `
                flex h-14 min-w-36 shrink-0 cursor-pointer items-center gap-3 rounded-lg
                border border-white/20 px-3 text-left text-(--text-color-on-main)
                shadow-md backdrop-blur-2xl transition-all duration-300 ease-in-out
                hover:bg-(--theme-color-main) active:scale-[0.98]
              `,
              selected ? "bg-(--theme-color-main)" : "bg-white/5"
            )}>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-black">{label}</span>
              <span className="block truncate text-[10px] font-bold uppercase opacity-60">
                {caption}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default memo(HomeChannelTabs);
