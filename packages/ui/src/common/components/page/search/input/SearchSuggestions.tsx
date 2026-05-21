import { type FC, memo, type Ref } from "react";
import { cx } from "@emotion/css";
import { DiscAlbum, ListMusic, Music2, User } from "lucide-react";

export type Suggestion = {
  id: number;
  name: string;
  type: "tracks" | "albums" | "playlists" | "artists";
};

interface SearchSuggestionsProps {
  ref?: Ref<HTMLUListElement>;
  suggestions: Suggestion[];
  onClick?: NormalFunc<[suggestion: Suggestion]>;
}

const SearchSuggestions: FC<SearchSuggestionsProps> = ({ suggestions, onClick, ref }) => {
  return (
    <ul
      ref={ref}
      className={cx(
        `
        absolute top-12 z-50 w-full space-y-1.5 rounded-lg border border-zinc-950/10
        bg-white/82 p-1 text-zinc-900 shadow-[0_18px_45px_rgba(0,0,0,0.16)]
        backdrop-blur-2xl transition-all ease-in-out duration-300
        `
      )}>
      {suggestions.map((suggestion) => {
        const Icon = getIcon(suggestion.type);
        return (
          <li
            key={suggestion.id}
            className={`
              text-sm flex justify-start items-center gap-1
              px-2 py-1 rounded-md h-8 text-zinc-700
              hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
              transition-all ease-in-out duration-300 cursor-pointer
            `}
            onClick={() => onClick?.(suggestion)}>
            <Icon className="size-4 inline-block shrink-0" />
            <p className="flex-1 truncate">{suggestion.name}</p>
          </li>
        );
      })}
    </ul>
  );
};

export default memo(SearchSuggestions);

function getIcon(type: "tracks" | "albums" | "playlists" | "artists") {
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
