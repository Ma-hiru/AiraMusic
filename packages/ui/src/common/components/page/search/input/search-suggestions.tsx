import { memo, type FC, type Ref, type FocusEventHandler } from "react";
import { User, Music2, Search, DiscAlbum, ListMusic, type LucideIcon } from "lucide-react";

export type Suggestion = {
  id: number;
  name: string;
  type: "albums" | "tracks" | "artists" | "playlists";
};

interface SearchSuggestionsProps {
  ref?: Ref<HTMLUListElement>;
  keyword?: string;
  suggestions: Suggestion[];
  onSearchAll?: NormalFunc;
  onBlur?: FocusEventHandler<HTMLUListElement>;
  onFocus?: FocusEventHandler<HTMLUListElement>;
  onClick?: NormalFunc<[suggestion: Suggestion]>;
}

const groupOrder: {
  label: string;
  type: Suggestion["type"];
}[] = [
  { type: "tracks", label: "单曲" },
  { type: "albums", label: "专辑" },
  { type: "playlists", label: "歌单" },
  { type: "artists", label: "歌手" }
];

const SearchSuggestions: FC<SearchSuggestionsProps> = ({
  ref,
  onBlur,
  onClick,
  onFocus,
  onSearchAll,
  keyword,
  suggestions
}) => {
  const groups = groupOrder
    .map(({ type, label }) => ({
      type,
      label,
      items: suggestions.filter((suggestion) => suggestion.type === type)
    }))
    .filter((group) => group.items.length > 0);

  return (
    <ul
      ref={ref}
      className="
        absolute top-12 z-60 w-full overflow-hidden rounded-xl border border-white/15
        bg-black/90 shadow-2xl backdrop-blur-2xl backdrop-saturate-150
      "
      aria-label="搜索建议"
      onBlur={onBlur}
      onFocus={onFocus}>
      {keyword && onSearchAll && (
        <li>
          <button
            className="
              flex w-full items-center gap-2 border-b border-white/10 px-3 py-2.5
              text-left text-white/80 transition-colors duration-200 hover:bg-white/10
            "
            type="button"
            onClick={onSearchAll}>
            <Search className="size-4 shrink-0 text-primary" />
            <span className="truncate text-[12px] font-semibold">搜索 “{keyword}”</span>
          </button>
        </li>
      )}
      <li className="max-h-72 overflow-y-auto p-1 scrollbar scrollbar-show">
        {groups.map((group) => (
          <div key={group.type}>
            <p className="px-2 pb-1 pt-2 text-[10px] font-semibold tracking-wider text-white/35">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((suggestion) => {
                const Icon = getIcon(suggestion.type);

                return (
                  <li key={`${suggestion.type}-${suggestion.id}`}>
                    <button
                      className="
                        flex h-8 w-full items-center gap-2 rounded-md px-2 text-left
                        text-[12px] text-white/75 outline-none transition-colors duration-200
                        hover:bg-white/10 hover:text-white
                        focus-visible:bg-white/10 focus-visible:text-white
                        focus-visible:ring-2 focus-visible:ring-primary/40
                      "
                      type="button"
                      onClick={() => onClick?.(suggestion)}>
                      <Icon className="size-4 shrink-0 opacity-70" />
                      <span className="flex-1 truncate">{suggestion.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </li>
      <li className="border-t border-white/10 px-3 py-2 text-[10px] text-white/30">
        按 Enter 搜索完整关键词
      </li>
    </ul>
  );
};

export default memo(SearchSuggestions);

function getIcon(type: Suggestion["type"]): LucideIcon {
  switch (type) {
    case "tracks":
      return Music2;
    case "albums":
      return DiscAlbum;
    case "playlists":
      return ListMusic;
    case "artists":
      return User;
  }
}
