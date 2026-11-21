import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import Search from "@/common/components/data-input/search";

export type AlbumTab = "albums" | "tracks";

interface ContentTabsProps {
  id: string;
  active: AlbumTab;
  trackCount: number;
  searchTracks: NormalFunc<[keyword: string]>;
  setIsTyping?: NormalFunc<[typing: boolean]>;
  onChange: NormalFunc<[tab: AlbumTab]>;
}

const ContentTabs: FC<ContentTabsProps> = ({
  id,
  setIsTyping = () => {},
  onChange,
  active,
  trackCount,
  searchTracks
}) => {
  return (
    <div className="mt-4 flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-ink/15">
      <div className="flex self-stretch gap-5" role="tablist" aria-label="专辑内容">
        {(
          [
            ["tracks", "歌曲"],
            ["albums", "其他专辑"]
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            id={`${id}-${value}-tab`}
            className={cx(
              "relative flex cursor-pointer items-center gap-1.5 whitespace-nowrap py-2 text-[12px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ink/60",
              active === value
                ? "text-m3-primary-90 after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-m3-primary-80"
                : "text-ink/70 hover:text-ink"
            )}
            role="tab"
            type="button"
            aria-selected={active === value}
            aria-controls={`${id}-${value}-panel`}
            onClick={() => onChange(value)}>
            {label}
            {value === "tracks" && (
              <span className="text-[10px] font-medium tabular-nums opacity-70">{trackCount}</span>
            )}
          </button>
        ))}
      </div>
      <div className={cx("min-w-0 shrink-0 py-1", active !== "tracks" && "invisible")}>
        <Search
          placeholder="搜索此专辑"
          iconClass="size-3.5!"
          setIsTyping={setIsTyping}
          containerClass="w-36 max-w-full"
          inputClass="h-7! w-full! rounded-md! border-ink/15! bg-ink/5! pl-2! text-ink! text-[11px]! placeholder:text-ink/65! focus:w-full!"
          onSearch={searchTracks}
        />
      </div>
    </div>
  );
};

export default memo(ContentTabs);
