import {
  type FC,
  memo,
  type Ref,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { Search, X } from "lucide-react";
import { cx } from "@emotion/css";
import { NeteaseAPISearch } from "@mahiru/ui/common/source/netease/api";
import { useLatestRef } from "@mahiru/ui/common/hooks/useLatestRef";
import { Log } from "@mahiru/ui/common/constants/dev";
import { debounce } from "lodash-es";
import { useSearchRecommend } from "@mahiru/ui/common/hooks/useSearchRecommend";
import SearchSuggestions, { type Suggestion } from "./SearchSuggestions";

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

  const renderSuggestions = useMemo<Suggestion[]>(() => {
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
    <div className={cx("relative flex h-11 w-full items-center justify-center gap-2", className)}>
      <section className="relative h-11 w-full max-w-3xl">
        <input
          ref={inputRef}
          type="text"
          className={`
            h-full w-full rounded-lg border border-zinc-950/10 bg-white/62
            px-4 pr-9 text-sm font-semibold text-zinc-800 outline-none
            shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl
            transition-all duration-300 ease-in-out
            placeholder:text-zinc-400
            focus:border-(--theme-color-main) focus:bg-white/82 focus:text-zinc-950
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
            onSearch("");
          }}
          className={cx(
            `
              absolute right-3 top-1/2 size-4 -translate-y-1/2 text-(--theme-color-main)
              rounded-full hover:bg-(--theme-color-main)/10
              transition-all duration-300 ease-in-out cursor-pointer
            `,
            focus ? "opacity-100" : "opacity-0"
          )}
        />
        <SearchSuggestions
          ref={ulRef}
          suggestions={renderSuggestions}
          onClick={(suggestion) => {
            setKeyword(suggestion.name);
            setSuggestions(null);
            onSearch(suggestion.name);
            setTabs(suggestion.type);
          }}
        />
      </section>
      <button
        type="button"
        title="搜索"
        className={cx(
          `
          flex size-11 shrink-0 items-center justify-center rounded-lg border border-zinc-950/10
          bg-zinc-950 text-white shadow-[0_10px_30px_rgba(0,0,0,0.14)]
          transition-all duration-300 ease-in-out hover:bg-(--theme-color-main)
          hover:text-(--text-color-on-main) active:scale-95
        `,
          focus && "border-(--theme-color-main)"
        )}
        onClick={() => {
          setKeyword(keyword || recommendKeyword || "");
          onSearch(keyword || recommendKeyword || "");
        }}>
        <Search className="size-5" />
      </button>
    </div>
  );
};

export default memo(SearchInput);
