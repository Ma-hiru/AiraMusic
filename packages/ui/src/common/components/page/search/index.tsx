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
  tracks: NeteaseTrackRecord[];
};

interface SearchProps {
  ref?: Ref<SearchRef>;
  className?: string;
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
      get tracks() {
        return trackResultRef.current?.tracks ?? [];
      }
    }),
    []
  );

  return (
    <div className={cx("flex flex-col gap-3 w-full h-full overflow-hidden", className)}>
      {/*搜索框*/}
      <Card
        className="flex flex-row items-center justify-between relative z-50"
        title="搜索"
        subTitle="Search">
        <SearchInput
          ref={inputRef}
          className="w-full flex flex-row justify-end"
          onSearch={applySearch}
          setTabs={(tab) => {
            setCurrentTab(tabOptions.find((option) => option.key === tab) ?? tabOptions[0]!);
          }}
        />
      </Card>
      {/*热搜列表*/}
      <HotRecommend
        className={cx("flex-1", keyword && "hidden")}
        onSearch={(nextKeyword) => {
          applySearch(nextKeyword);
          inputRef.current?.setKeyword(nextKeyword);
        }}
      />
      {/*搜索结果*/}
      <section
        className={cx(
          "grid flex-1 grid-cols-1 gap-3 md:grid-cols-[220px_minmax(0,1fr)] grid-rows-[auto_1fr] md:grid-rows-1",
          !keyword && "hidden"
        )}>
        <Card subTitle="Matches" title={count + "条"} Icon={currentTab.icon}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {tabOptions.map((option) => {
              const Icon = option.icon;
              const active = option.key === currentTab.key;
              return (
                <Card
                  key={option.key}
                  className="p-0! rounded-md overflow-hidden"
                  onClick={() => setCurrentTab(option)}
                  children={
                    <div
                      className={cx(
                        `
                        flex h-12 items-center gap-2  px-3 text-left
                        transition-all duration-300 active:scale-[0.98] cursor-pointer
                      `,
                        active
                          ? "bg-primary text-primary-text hover:bg-primary-active"
                          : "hover:bg-white/20"
                      )}>
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{option.label}</span>
                        <span className="block truncate text-[10px] font-bold">
                          {option.caption}
                        </span>
                      </span>
                    </div>
                  }
                />
              );
            })}
          </div>
        </Card>
        <Card className="flex flex-col p-0!">
          {!!(mounted & 0b1) && (
            <TrackResult
              ref={trackResultRef}
              className={cx((currentTab.key !== "tracks" || !keyword) && "hidden")}
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
              className={cx((currentTab.key !== "albums" || !keyword) && "hidden")}
              keywords={keyword}
              setCount={setCount}
              active={currentTab.key === "albums"}
              onJumpAlbum={onClickAlbum}
            />
          )}
          {!!(mounted & 0b100) && (
            <PlaylistResult
              className={cx((currentTab.key !== "playlists" || !keyword) && "hidden")}
              keywords={keyword}
              setCount={setCount}
              active={currentTab.key === "playlists"}
              onJumpPlaylist={onClickPlaylist}
            />
          )}
          {!!(mounted & 0b1000) && (
            <ArtistResult
              className={cx((currentTab.key !== "artists" || !keyword) && "hidden")}
              keywords={keyword}
              setCount={setCount}
              active={currentTab.key === "artists"}
              onJumpArtist={onClickArtist}
            />
          )}
        </Card>
      </section>
    </div>
  );
};

export default memo(Search);
