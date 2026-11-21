import { cx } from "@emotion/css";
import { memo, type FC } from "react";
import Search from "@/common/components/data-input/search";

export type PlaylistTab = "albums" | "tracks" | "artists" | "similar";

interface ContentTabsProps {
  id: string;
  keyword: string;
  trackCount: number;
  active: PlaylistTab;
  albumCount?: number;
  artistCount?: number;
  isLikedList?: boolean;
  searchTracks: NormalFunc<[keyword: string]>;
  setIsTyping?: NormalFunc<[typing: boolean]>;
  onChange: NormalFunc<[tab: PlaylistTab]>;
  onKeywordChange: NormalFunc<[keyword: string]>;
}

const ContentTabs: FC<ContentTabsProps> = ({
  id,
  setIsTyping = () => {},
  onChange,
  onKeywordChange,
  active,
  keyword,
  trackCount,
  searchTracks,
  albumCount = 0,
  artistCount = 0,
  isLikedList = false
}) => {
  const tabs: [PlaylistTab, string, number?][] = isLikedList
    ? [
        ["tracks", "歌曲", trackCount],
        ["artists", "按歌手", artistCount],
        ["albums", "按专辑", albumCount]
      ]
    : [
        ["tracks", "歌曲", trackCount],
        ["similar", "相似歌单"]
      ];
  const placeholder =
    active === "artists"
      ? "搜索歌手"
      : active === "albums"
        ? "搜索专辑"
        : isLikedList
          ? "搜索喜欢的音乐"
          : "搜索此歌单";
  return (
    <div className="mt-4 flex min-h-10 shrink-0 items-center justify-between gap-3 border-b border-ink/15">
      <div className="flex self-stretch gap-5" role="tablist" aria-label="歌单内容">
        {tabs.map(([value, label, count]) => (
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
            {count !== undefined && (
              <span className="text-[10px] font-medium tabular-nums opacity-70">{count}</span>
            )}
          </button>
        ))}
      </div>
      <div
        className={cx("min-w-0 shrink-0 py-1", active === "similar" && "invisible")}
        inert={active === "similar"}>
        <Search
          value={keyword}
          iconClass="size-3.5!"
          placeholder={placeholder}
          setIsTyping={setIsTyping}
          containerClass="w-36 max-w-full"
          inputClass="h-6! w-full! rounded-md! border-ink/15! bg-ink/5! pl-2! text-ink! text-[11px]! placeholder:text-ink/65! focus:w-full!"
          onSearch={searchTracks}
          onValueChange={onKeywordChange}
        />
      </div>
    </div>
  );
};

export default memo(ContentTabs);
