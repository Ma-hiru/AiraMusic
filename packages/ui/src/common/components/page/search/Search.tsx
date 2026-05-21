import { cx } from "@emotion/css";
import {
  type FC,
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { DiscAlbum, ListMusic, Music2, Search as SearchIcon, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AlbumResult, ArtistResult, PlaylistResult, TrackResult } from "./content";
import type { SearchInputRef } from "@mahiru/ui/common/components/page/search/input/SearchInput";
import { NeteaseHistory, NeteaseTrackRecord } from "@mahiru/ui/common/source/netease/models";
import { NeteaseImageSize } from "@mahiru/ui/common/enum";
import type { HeartManager } from "@mahiru/ui/common/hooks/useHeart";
import type { TrackListPlayableManager } from "@mahiru/ui/common/components/track_list";
import type { TrackResultRef } from "@mahiru/ui/common/components/page/search/content/TrackResult";

import SearchInput from "./input";
import HotRecommend from "./HotRecommend";

export type SearchRef = {
  tracks: NeteaseTrackRecord[];
};

interface SearchProps {
  ref?: Ref<SearchRef>;
  className?: string;
  defaultKeyword: Optional<string>;
  onClickPlaylist: Optional<NormalFunc<[id: number]>>;
  activeTrackID: Undefinable<number>;
  onClickTrack: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  coverSize: NeteaseImageSize;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
}

type SearchTab = "tracks" | "albums" | "playlists" | "artists";

const tabOptions: {
  key: SearchTab;
  label: string;
  caption: string;
  icon: LucideIcon;
}[] = [
  { key: "tracks", label: "单曲", caption: "Songs", icon: Music2 },
  { key: "albums", label: "专辑", caption: "Albums", icon: DiscAlbum },
  { key: "playlists", label: "歌单", caption: "Playlists", icon: ListMusic },
  { key: "artists", label: "歌手", caption: "Artists", icon: UserRound }
];

const Search: FC<SearchProps> = ({
  ref,
  className,
  defaultKeyword,
  onClickPlaylist,
  activeTrackID,
  onClickTrack,
  onClickArtist,
  onClickAlbum,
  addToPlaylistNext,
  addToPlaylistLast,
  openComment,
  coverSize,
  heartManager,
  playableManager
}) => {
  const [keyword, setKeyword] = useState("");
  const [tabs, setTabs] = useState<SearchTab>("tracks");
  const [trackListMounted, setTrackListMounted] = useState(false);
  const [albumListMounted, setAlbumListMounted] = useState(false);
  const [artistListMounted, setArtistListMounted] = useState(false);
  const [playlistListMounted, setPlaylistListMounted] = useState(false);
  const [count, setCount] = useState(0);
  const inputRef = useRef<SearchInputRef>(null);
  const trackResultRef = useRef<TrackResultRef>(null);
  const activeTab = useMemo(
    () => tabOptions.find((option) => option.key === tabs) ?? tabOptions[0]!,
    [tabs]
  );
  const ActiveIcon = activeTab.icon;

  const applySearch = useCallback((nextKeyword: string) => {
    setKeyword(nextKeyword.trim());
  }, []);

  useEffect(() => {
    if (defaultKeyword && defaultKeyword !== inputRef.current?.keyword) {
      setKeyword(defaultKeyword);
      inputRef.current?.setKeyword(defaultKeyword);
      inputRef.current?.focus();
    }
  }, [defaultKeyword]);

  useEffect(() => {
    switch (tabs) {
      case "albums":
        return setAlbumListMounted(true);
      case "artists":
        return setArtistListMounted(true);
      case "playlists":
        return setPlaylistListMounted(true);
      case "tracks":
        return setTrackListMounted(true);
    }
  }, [tabs]);

  useImperativeHandle(
    ref,
    () => ({
      get tracks() {
        return trackResultRef.current?.tracks ?? [];
      }
    }),
    []
  );

  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden text-zinc-950", className)}>
      <section
        className={cx(
          `
          shrink-0 rounded-lg border border-white/45 bg-white/50 p-3
          shadow-[0_18px_55px_rgba(0,0,0,0.12)] backdrop-blur-2xl
        `,
          keyword ? "mb-3" : "mb-4"
        )}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(360px,560px)] lg:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <SearchIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500">
                {keyword ? "Search Result" : "Search Console"}
              </p>
              <h1 className="mt-0.5 truncate text-2xl font-black tracking-normal text-zinc-950">
                {keyword ? keyword : "搜索音乐"}
              </h1>
            </div>
          </div>
          <SearchInput ref={inputRef} onSearch={applySearch} setTabs={setTabs} />
        </div>
      </section>

      <HotRecommend
        className={cx("min-h-0 flex-1", keyword && "hidden")}
        onSearch={(nextKeyword) => {
          applySearch(nextKeyword);
          inputRef.current?.setKeyword(nextKeyword);
        }}
      />

      <section
        className={cx(
          "grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)]",
          !keyword && "hidden"
        )}>
        <aside
          className={cx(
            `
            flex min-h-0 flex-col rounded-lg border border-white/40 bg-white/46 p-3
            shadow-[0_12px_35px_rgba(0,0,0,0.10)] backdrop-blur-2xl
          `
          )}>
          <div className="mb-3 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-(--theme-color-main) text-(--text-color-on-main)">
              <ActiveIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-zinc-500">
                Result Type
              </p>
              <h2 className="truncate text-xl font-black tracking-normal">{activeTab.label}</h2>
            </div>
          </div>
          <div className="mb-4 rounded-md border border-zinc-950/10 bg-white/40 px-3 py-2">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-zinc-400">
              Matches
            </p>
            <p className="mt-1 text-2xl font-black tracking-normal text-zinc-950">{count}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {tabOptions.map((option) => {
              const Icon = option.icon;
              const active = option.key === tabs;
              return (
                <button
                  key={option.key}
                  type="button"
                  title={`查看${option.label}`}
                  onClick={() => setTabs(option.key)}
                  className={cx(
                    `
                    flex h-12 items-center gap-2 rounded-md border px-3 text-left
                    transition-all duration-300 active:scale-[0.98]
                  `,
                    active
                      ? "border-zinc-950 bg-zinc-950 text-white shadow-[0_12px_28px_rgba(0,0,0,0.18)]"
                      : "border-zinc-950/10 bg-white/35 text-zinc-700 hover:border-(--theme-color-main)/50 hover:bg-white/70"
                  )}>
                  <Icon
                    className={cx(
                      "size-4 shrink-0",
                      active ? "text-(--theme-color-main)" : "text-zinc-500"
                    )}
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-black">{option.label}</span>
                    <span
                      className={cx(
                        "block truncate text-[10px] font-bold",
                        active ? "text-white/45" : "text-zinc-400"
                      )}>
                      {option.caption}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section
          className={cx(
            `
            flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/40 bg-white/44 p-2
            shadow-[0_12px_35px_rgba(0,0,0,0.10)] backdrop-blur-2xl
          `
          )}>
          <div className="mb-2 flex shrink-0 items-center justify-between rounded-md bg-zinc-950/5 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-black tracking-normal text-zinc-950">
                {activeTab.label}结果
              </p>
              <p className="truncate text-[11px] font-semibold text-zinc-500">
                {keyword} · {count}条
              </p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {trackListMounted && (
              <TrackResult
                ref={trackResultRef}
                className={cx("h-full min-h-0", (tabs !== "tracks" || !keyword) && "hidden")}
                keywords={keyword}
                activeTrackID={activeTrackID}
                onClick={onClickTrack}
                onClickArtist={onClickArtist}
                onClickAlbum={onClickAlbum}
                addToPlaylistNext={addToPlaylistNext}
                addToPlaylistLast={addToPlaylistLast}
                openComment={openComment}
                coverSize={coverSize}
                heartManager={heartManager}
                playableManager={playableManager}
                active={tabs === "tracks"}
                setCount={setCount}
              />
            )}
            {albumListMounted && (
              <AlbumResult
                className={cx("h-full min-h-0", (tabs !== "albums" || !keyword) && "hidden")}
                keywords={keyword}
                onJumpAlbum={onClickAlbum}
                active={tabs === "albums"}
                setCount={setCount}
              />
            )}
            {artistListMounted && (
              <ArtistResult
                className={cx("h-full min-h-0", (tabs !== "artists" || !keyword) && "hidden")}
                keywords={keyword}
                onJumpArtist={onClickArtist}
                active={tabs === "artists"}
                setCount={setCount}
              />
            )}
            {playlistListMounted && (
              <PlaylistResult
                className={cx("h-full min-h-0", (tabs !== "playlists" || !keyword) && "hidden")}
                keywords={keyword}
                onJumpPlaylist={onClickPlaylist}
                active={tabs === "playlists"}
                setCount={setCount}
              />
            )}
          </div>
        </section>
      </section>
    </div>
  );
};

export default memo(Search);
