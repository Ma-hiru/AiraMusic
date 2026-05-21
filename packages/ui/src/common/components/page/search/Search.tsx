import { cx } from "@emotion/css";
import { type FC, memo, type Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlbumResult, ArtistResult, PlaylistResult, TrackResult } from "./content";
import type { SearchInputRef } from "@mahiru/ui/common/components/page/search/input/SearchInput";
import { NeteaseHistory, NeteaseTrackRecord } from "@mahiru/ui/common/source/netease/models";
import { NeteaseImageSize } from "@mahiru/ui/common/enum";
import type { HeartManager } from "@mahiru/ui/common/hooks/useHeart";
import type { TrackListPlayableManager } from "@mahiru/ui/common/components/track_list";
import type { TrackResultRef } from "@mahiru/ui/common/components/page/search/content/TrackResult";

import SearchInput from "./input";
import HotRecommend from "./HotRecommend";
import SectionTab from "@mahiru/ui/common/components/tab/SectionTab";

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

const tabsName = ["单曲", "专辑", "歌单", "歌手"];
const mapTabsToIdx = {
  tracks: 0,
  albums: 1,
  playlists: 2,
  artists: 3
} as const;
const mapIdxToTabs: Record<number, "tracks" | "albums" | "playlists" | "artists"> = {
  0: "tracks",
  1: "albums",
  2: "playlists",
  3: "artists"
};

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
  const [tabs, setTabs] = useState<"tracks" | "albums" | "playlists" | "artists">("tracks");
  const [trackListMounted, setTrackListMounted] = useState(false);
  const [albumListMounted, setAlbumListMounted] = useState(false);
  const [artistListMounted, setArtistListMounted] = useState(false);
  const [playlistListMounted, setPlaylistListMounted] = useState(false);
  const [count, setCount] = useState(0);
  const inputRef = useRef<SearchInputRef>(null);
  const trackResultRef = useRef<TrackResultRef>(null);

  useEffect(() => {
    if (defaultKeyword && defaultKeyword !== inputRef.current?.keyword) {
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
    <div className={cx("flex flex-col justify-start pb-2", className)}>
      <SearchInput ref={inputRef} onSearch={setKeyword} setTabs={setTabs} />
      <HotRecommend
        className={cx("m-2 flex-1", keyword && "hidden")}
        onSearch={(k) => {
          setKeyword(k);
          inputRef.current?.setKeyword(k);
        }}
      />
      <section
        className={cx(
          `w-full shrink-0 flex justify-between items-center m-2`,
          !keyword && "hidden"
        )}>
        <div className="font-semibold text-2xl flex gap-1 items-end">
          <h1>{tabsName[mapTabsToIdx[tabs]]}</h1>
          <p className="opacity-80 font-medium text-base">{count}条结果</p>
        </div>
        <SectionTab
          data={tabsName}
          activeIndex={mapTabsToIdx[tabs]}
          onChange={(idx) => setTabs(mapIdxToTabs[idx]!)}
          mode="less-theme"
          className="text-[12px]"
        />
      </section>
      {trackListMounted && (
        <TrackResult
          ref={trackResultRef}
          className={cx("flex-1", (tabs !== "tracks" || !keyword) && "hidden")}
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
          className={cx("flex-1", (tabs !== "albums" || !keyword) && "hidden")}
          keywords={keyword}
          onJumpAlbum={onClickAlbum}
          active={tabs === "albums"}
          setCount={setCount}
        />
      )}
      {artistListMounted && (
        <ArtistResult
          className={cx("flex-1", (tabs !== "artists" || !keyword) && "hidden")}
          keywords={keyword}
          onJumpArtist={onClickArtist}
          active={tabs === "artists"}
          setCount={setCount}
        />
      )}
      {playlistListMounted && (
        <PlaylistResult
          className={cx("flex-1", (tabs !== "playlists" || !keyword) && "hidden")}
          keywords={keyword}
          onJumpPlaylist={onClickPlaylist}
          active={tabs === "playlists"}
          setCount={setCount}
        />
      )}
    </div>
  );
};

export default memo(Search);
