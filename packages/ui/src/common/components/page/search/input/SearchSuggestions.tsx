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
        absolute w-full top-10 space-y-2 p-1
        bg-white/35 text-(--text-color-on-main) rounded-md shadow-md
        backdrop-blur-lg transition-all ease-in-out duration-300 z-50
        `
      )}>
      {suggestions.map((suggestion) => {
        const Icon = getIcon(suggestion.type);
        return (
          <li
            key={suggestion.id}
            className={`
              text-sm flex justify-start items-center gap-1
              px-1.5 py-0.5 rounded-full h-6 text-(--theme-color-main)
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
