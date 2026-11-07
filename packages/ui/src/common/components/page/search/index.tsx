import { cx } from "@emotion/css";
import { Music2, DiscAlbum, ListMusic, UserRound } from "lucide-react";
import {
  memo,
  useRef,
  type FC,
  type Ref,
  useState,
  useEffect,
  useCallback,
  useImperativeHandle
} from "react";
import { NeteaseImageSize } from "@/common/enum";
import { useAgentFocusCtx } from "@/common/hooks/use-agent-focus-ctx";
import { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import Card from "@/common/components/layout/card";
import type { LucideIcon } from "lucide-react";
import type { HeartManager } from "@/common/hooks/use-heart";
import type { TrackListPlayableManager } from "@/common/components/display/track_list";

import SearchInput from "./input";
import HotRecommend from "./hot-recommend";
import type { SearchInputRef } from "./input/search-input";
import type { TrackResultRef } from "./content/track-result";
import { AlbumResult, TrackResult, ArtistResult, PlaylistResult } from "./content";

export type SearchRef = {
  currentKeyword: string;
  tracks: NeteaseTrackRecord[];
};

interface SearchProps {
  ref?: Ref<SearchRef>;
  className?: string;
  routerActive: boolean;
  coverSize: NeteaseImageSize;
  defaultKeyword: Optional<string>;
  activeTrackID: Undefinable<number>;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addTrackToPlaylist: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  onClickAlbum: NormalFunc<[id: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onClickPlaylist: Optional<NormalFunc<[id: number]>>;
  onClickTrack: NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>;
}

type Tab = {
  index: number;
  label: string;
  caption: string;
  icon: LucideIcon;
  key: "albums" | "tracks" | "artists" | "playlists";
};

const tabOptions: Tab[] = [
  { index: 0, key: "tracks", label: "单曲", caption: "Songs", icon: Music2 },
  { index: 1, key: "albums", label: "专辑", caption: "Albums", icon: DiscAlbum },
  { index: 2, key: "playlists", label: "歌单", caption: "Playlists", icon: ListMusic },
  { index: 3, key: "artists", label: "歌手", caption: "Artists", icon: UserRound }
];

const Search: FC<SearchProps> = ({
  ref,
  className,
  activeTrackID,
  heartManager,
  playableManager,
  addToPlaylistLast,
  addToPlaylistNext,
  addTrackToPlaylist,
  openComment,
  onClickAlbum,
  onClickTrack,
  onClickArtist,
  onClickPlaylist,
  coverSize,
  routerActive,
  defaultKeyword
}) => {
  const [keyword, setKeyword] = useState("");
  const [currentTab, setCurrentTab] = useState<Tab>(tabOptions[0]!);
  const [mounted, setMounted] = useState(0);
  const [count, setCount] = useState(0);
  const inputRef = useRef<SearchInputRef>(null);
  const trackResultRef = useRef<TrackResultRef>(null);

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

  // 只有点击tab才会挂载，默认不渲染
  useEffect(() => setMounted((bit) => bit | (1 << currentTab.index)), [currentTab.index]);

  useImperativeHandle(
    ref,
    () => ({
      currentKeyword: keyword,
      get tracks() {
        return trackResultRef.current?.tracks ?? [];
      }
    }),
    [keyword]
  );

  useAgentFocusCtx({ page: "search", keyword }, routerActive);

  return (
    <div className={cx("flex h-full w-full flex-col gap-3 overflow-hidden", className)}>
      <div className="relative z-50 flex shrink-0 flex-wrap items-center gap-3">
        <div className="min-w-0 shrink-0">
          <h1 className="text-[28px] font-bold leading-tight">搜索</h1>
        </div>
        <SearchInput
          ref={inputRef}
          className="min-w-0 flex-1"
          onSearch={applySearch}
          setTabs={(tab) => {
            setCurrentTab(tabOptions.find((option) => option.key === tab) ?? tabOptions[0]!);
          }}
        />
      </div>

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden p-0!">
        <HotRecommend
          className={cx("min-h-0 flex-1", keyword && "hidden")}
          onSearch={(nextKeyword) => {
            applySearch(nextKeyword);
            inputRef.current?.setKeyword(nextKeyword);
          }}
        />

        <section className={cx("flex min-h-0 flex-1", !keyword && "hidden")}>
          <aside className="flex w-48 shrink-0 flex-col border-r border-white/[0.06] px-4 py-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40">Matches</p>
              <p className="mt-1 flex items-baseline gap-1 leading-none">
                <span className="text-[22px] font-bold tabular-nums">{count}</span>
                <span className="text-[11px] font-semibold opacity-40">条</span>
              </p>
            </div>
            <nav className="mt-4 flex flex-col gap-1" aria-label="搜索结果类型">
              {tabOptions.map((option) => {
                const Icon = option.icon;
                const active = option.key === currentTab.key;

                return (
                  <button
                    key={option.key}
                    className={cx(
                      `
                        flex w-full items-center gap-2 rounded-md px-3 py-2 text-left
                        transition-colors duration-200 ease-in-out
                      `,
                      active
                        ? "bg-primary text-primary-text"
                        : "text-(--text-color)/55 hover:bg-white/[0.06] hover:text-(--text-color)"
                    )}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setCurrentTab(option)}>
                    <Icon className="size-4 shrink-0" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{option.label}</span>
                      <span className="block truncate text-[10px] font-bold opacity-50">
                        {option.caption}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="relative min-h-0 flex-1">
            {!!(mounted & 0b1) && (
              <TrackResult
                ref={trackResultRef}
                className={cx("h-full", (currentTab.key !== "tracks" || !keyword) && "hidden")}
                keywords={keyword}
                setCount={setCount}
                coverSize={coverSize}
                openComment={openComment}
                heartManager={heartManager}
                activeTrackID={activeTrackID}
                playableManager={playableManager}
                active={currentTab.key === "tracks"}
                addToPlaylistLast={addToPlaylistLast}
                addToPlaylistNext={addToPlaylistNext}
                addTrackToPlaylist={addTrackToPlaylist}
                onClick={onClickTrack}
                onClickAlbum={onClickAlbum}
                onClickArtist={onClickArtist}
              />
            )}
            {!!(mounted & 0b10) && (
              <AlbumResult
                className={cx("h-full", (currentTab.key !== "albums" || !keyword) && "hidden")}
                keywords={keyword}
                setCount={setCount}
                active={currentTab.key === "albums"}
                onJumpAlbum={onClickAlbum}
              />
            )}
            {!!(mounted & 0b100) && (
              <PlaylistResult
                className={cx("h-full", (currentTab.key !== "playlists" || !keyword) && "hidden")}
                keywords={keyword}
                setCount={setCount}
                active={currentTab.key === "playlists"}
                onJumpPlaylist={onClickPlaylist}
              />
            )}
            {!!(mounted & 0b1000) && (
              <ArtistResult
                className={cx("h-full", (currentTab.key !== "artists" || !keyword) && "hidden")}
                keywords={keyword}
                setCount={setCount}
                active={currentTab.key === "artists"}
                onJumpArtist={onClickArtist}
              />
            )}
          </div>
        </section>
      </Card>
    </div>
  );
};

export default memo(Search);
