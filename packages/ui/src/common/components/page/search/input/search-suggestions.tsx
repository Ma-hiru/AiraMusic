import { type FC, type FocusEventHandler, memo, type Ref } from "react";
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
  onBlur?: FocusEventHandler<HTMLUListElement>;
  onClick?: NormalFunc<[suggestion: Suggestion]>;
  onFocus?: FocusEventHandler<HTMLUListElement>;
}

const SearchSuggestions: FC<SearchSuggestionsProps> = ({
  suggestions,
  onBlur,
  onClick,
  onFocus,
  ref
}) => {
  return (
    <ul
      ref={ref}
      aria-label="搜索建议"
      onBlur={onBlur}
      onFocus={onFocus}
      className={cx(
        `
        absolute top-12 z-60 w-full space-y-1.5 rounded-lg
        transition-all ease-in-out duration-300
        backdrop-blur-lg p-1 surface-1
      `
      )}>
      {suggestions.map((suggestion) => {
        const Icon = getIcon(suggestion.type);
        return (
          <li key={suggestion.id} className="h-8">
            <button
              type="button"
              className={`
                flex h-full w-full items-center justify-start gap-1
                rounded-md border-0 bg-transparent px-2 py-1 text-left text-sm
                outline-none transition-all duration-300 ease-in-out cursor-pointer
                hover:bg-primary hover:text-primary-text
                focus-visible:bg-primary focus-visible:text-primary-text
                focus-visible:ring-2 focus-visible:ring-primary/40
              `}
              onClick={() => onClick?.(suggestion)}>
              <Icon className="size-4 inline-block shrink-0" />
              <span className="flex-1 truncate">{suggestion.name}</span>
            </button>
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
