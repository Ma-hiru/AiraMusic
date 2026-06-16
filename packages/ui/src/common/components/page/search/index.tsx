import { cx } from "@emotion/css";
import {
  type FC,
  memo,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";
import type { LucideIcon } from "lucide-react";
import { DiscAlbum, ListMusic, Music2, UserRound } from "lucide-react";
import { AlbumResult, ArtistResult, PlaylistResult, TrackResult } from "./content";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";
import type { SearchInputRef } from "./input/search-input";
import type { HeartManager } from "@/common/hooks/use-heart";
import type { TrackListPlayableManager } from "@/common/components/display/track_list";
import type { TrackResultRef } from "./content/track-result";

import SearchInput from "./input";
import HotRecommend from "./hot-recommend";
import Card from "@/common/components/layout/card";

export type SearchRef = {
  tracks: NeteaseTrackRecord[];
};

interface SearchProps {
  ref?: Ref<SearchRef>;
  className?: string;
  defaultKeyword: Optional<string>;
  onClickPlaylist: Optional<NormalFunc<[id: number]>>;
  activeTrackID: Undefinable<number>;
  onClickTrack: NormalFunc<[track: NeteaseTrackRecord | NeteaseHistoryRecord, index: number]>;
  onClickArtist: NormalFunc<[id: number]>;
  onClickAlbum: NormalFunc<[id: number]>;
  addToPlaylistNext: NormalFunc<[track: NeteaseTrackRecord]>;
  addToPlaylistLast: NormalFunc<[track: NeteaseTrackRecord]>;
  openComment: NormalFunc<[track: NeteaseTrackRecord]>;
  coverSize: NeteaseImageSize;
  heartManager: HeartManager;
  playableManager: TrackListPlayableManager;
}

type Tab = {
  index: number;
  key: "tracks" | "albums" | "playlists" | "artists";
  label: string;
  caption: string;
  icon: LucideIcon;
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
          className="w-full flex flex-row justify-end"
          ref={inputRef}
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
        <Card title={count + "条"} subTitle="Matches" Icon={currentTab.icon}>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {tabOptions.map((option) => {
              const Icon = option.icon;
              const active = option.key === currentTab.key;
              return (
                <Card
                  key={option.key}
                  onClick={() => setCurrentTab(option)}
                  className="p-0! rounded-md overflow-hidden"
                  children={
                    <div
                      className={cx(
                        `
                        flex h-12 items-center gap-2  px-3 text-left
                        transition-all duration-300 active:scale-[0.98] cursor-pointer
                        hover:bg-(--theme-color-main) hover:text-(--text-color-on-main)
                      `,
                        active && "bg-(--theme-color-main) text-(--text-color-on-main)"
                      )}>
                      <Icon className="size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-black">{option.label}</span>
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
              active={currentTab.key === "tracks"}
              setCount={setCount}
            />
          )}
          {!!(mounted & 0b10) && (
            <AlbumResult
              className={cx((currentTab.key !== "albums" || !keyword) && "hidden")}
              keywords={keyword}
              onJumpAlbum={onClickAlbum}
              active={currentTab.key === "albums"}
              setCount={setCount}
            />
          )}
          {!!(mounted & 0b100) && (
            <PlaylistResult
              className={cx((currentTab.key !== "playlists" || !keyword) && "hidden")}
              keywords={keyword}
              onJumpPlaylist={onClickPlaylist}
              active={currentTab.key === "playlists"}
              setCount={setCount}
            />
          )}
          {!!(mounted & 0b1000) && (
            <ArtistResult
              className={cx((currentTab.key !== "artists" || !keyword) && "hidden")}
              keywords={keyword}
              onJumpArtist={onClickArtist}
              active={currentTab.key === "artists"}
              setCount={setCount}
            />
          )}
        </Card>
      </section>
    </div>
  );
};

export default memo(Search);
