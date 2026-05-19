import {
  FC,
  memo,
  Ref,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { DiscAlbum, ListMusic, Music2, Search, User, X } from "lucide-react";
import { cx } from "@emotion/css";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import { useLatestRef } from "@mahiru/ui/common/hooks/useLatestRef";
import { Log } from "@mahiru/ui/common/constants/dev";
import { debounce } from "lodash-es";
import { useSearchRecommend } from "@mahiru/ui/common/hooks/useSearchRecommend";

export type SearchInputRef = {
  isFocus: boolean;
  focus: NormalFunc;
  blur: NormalFunc;
  keyword: string;
  setKeyword: NormalFunc<[keyword: string]>;
};

interface SearchInputProps {
  className?: string;
  onSearch: NormalFunc<[keyword: string]>;
  setTabs: NormalFunc<[tab: "tracks" | "albums" | "playlists" | "artists"]>;
  ref?: Ref<SearchInputRef>;
}

const SearchInput: FC<SearchInputProps> = ({ className, onSearch, ref, setTabs }) => {
  const [focus, setFocus] = useState(false);
  const [keyword, setKeyword] = useState("");
  const [suggestions, setSuggestions] =
    useState<Nullable<NeteaseAPI.NeteaseSearchSuggestionResponse["result"]>>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ulRef = useRef<HTMLUListElement>(null);
  const loading = useRef(false);
  const keywordRef = useLatestRef(keyword);
  const focusRef = useLatestRef(focus);
  const recommendKeyword = useSearchRecommend();

  const getSuggestions = useCallback(async () => {
    if (!keywordRef.current) return setSuggestions(null);
    if (loading.current) return;
    loading.current = true;
    NeteaseAPISearch.suggest(keywordRef.current)
      .then(({ result }) => setSuggestions(result))
      .catch((err) => {
        Log.error("search suggestions", err);
        setSuggestions(null);
      })
      .finally(() => (loading.current = false));
  }, [keywordRef]);

  const debouncedGetSuggestions = useMemo(() => debounce(getSuggestions, 300), [getSuggestions]);

  const renderSuggestions = useMemo(() => {
    if (!suggestions) return [];
    const { albums = [], artists = [], playlists = [], songs = [] } = suggestions;
    return [
      songs.slice(0, 3).map((song) => ({ name: song.name, type: "tracks" as const, id: song.id })),
      albums
        .slice(0, 3)
        .map((album) => ({ name: album.name, type: "albums" as const, id: album.id })),
      playlists
        .slice(0, 3)
        .map((playlist) => ({ name: playlist.name, type: "playlists" as const, id: playlist.id })),
      artists
        .slice(0, 3)
        .filter((artist): artist is { name: string; id: number } => !!(artist.name && artist.id))
        .map((artist) => ({ name: artist.name, type: "artists" as const, id: artist.id }))
    ].flat();
  }, [suggestions]);

  useLayoutEffect(() => {
    const ul = ulRef.current;
    if (!ul) return;
    let cancel = false;
    if (focus && renderSuggestions.length > 0) {
      ul.style.display = "block";
      ul.style.opacity = "100%";
    } else {
      ul.style.opacity = "0%";
      setTimeout(() => {
        if (cancel) return;
        ul.style.display = "none";
      }, 300);
    }
    return () => {
      cancel = true;
    };
  }, [focus, renderSuggestions.length]);

  useImperativeHandle(
    ref,
    () => ({
      get isFocus() {
        return focusRef.current;
      },
      get keyword() {
        return keywordRef.current;
      },
      focus: () => inputRef.current?.focus(),
      blur: () => inputRef.current?.blur(),
      setKeyword
    }),
    [focusRef, keywordRef]
  );

  return (
    <div className={cx(`w-full h-10 flex items-center justify-center gap-2 relative`, className)}>
      <section className="h-8 w-4/5 md:w-1/2 relative">
        <input
          ref={inputRef}
          type="text"
          className={`
            text-sm border border-(--text-color-on-main) rounded-full px-4 pr-6 py-1 outline-none
            focus:ring-2 focus:ring-(--theme-color-main) focus:border-transparent
            transition-all duration-300 ease-in-out focus:text-(--theme-color-main)
            placeholder:text-(--text-color-on-main)/50 w-full
        `}
          value={keyword}
          placeholder={recommendKeyword ?? "请输入搜索关键词"}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onChange={(e) => {
            setKeyword(e.target.value);
            debouncedGetSuggestions();
          }}
          onKeyUp={(e) => {
            if (e.key === "Enter") {
              onSearch(keyword);
              e.currentTarget.blur();
            }
          }}
        />
        <X
          onClick={() => {
            setKeyword("");
            setSuggestions(null);
          }}
          className={cx(
            `
              size-4 absolute right-2 top-2 text-(--theme-color-main)
              hover:bg-(--theme-color-main)/10 rounded-full
              transition-all duration-300 ease-in-out cursor-pointer
            `,
            focus ? "opacity-100" : "opacity-0"
          )}
        />
        <ul
          ref={ulRef}
          className={cx(
            `
              absolute w-full top-10 space-y-2 p-1
              bg-white/10 text-(--text-color-on-main) rounded-md shadow-md
              backdrop-blur-sm transition-all ease-in-out duration-300 z-50
            `
          )}>
          {renderSuggestions.map((suggestion) => {
            let Icon;
            switch (suggestion.type) {
              case "tracks":
                Icon = Music2;
                break;
              case "albums":
                Icon = DiscAlbum;
                break;
              case "playlists":
                Icon = ListMusic;
                break;
              case "artists":
                Icon = User;
                break;
            }
            return (
              <li
                key={suggestion.id}
                className={`
                  text-sm flex justify-start items-center gap-1
                  px-1.5 py-0.5 rounded-full h-6 text-(--theme-color-main)
                  hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
                  transition-all ease-in-out duration-300 cursor-pointer
                `}
                onClick={() => {
                  setKeyword(suggestion.name);
                  setSuggestions(null);
                  onSearch(suggestion.name);
                  setTabs(suggestion.type);
                }}>
                <Icon className="size-4 inline-block shrink-0" />
                <p className="flex-1 truncate">{suggestion.name}</p>
              </li>
            );
          })}
        </ul>
      </section>
      <Search
        className={cx(
          `
          cursor-pointer hover:text-(--theme-color-main)/50 size-6
          transition-all duration-300 ease-in-out active:scale-95
        `,
          focus && "text-(--theme-color-main)"
        )}
      />
    </div>
  );
};

export default memo(SearchInput);
