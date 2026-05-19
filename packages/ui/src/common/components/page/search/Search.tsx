import { cx } from "@emotion/css";
import { FC, memo, Ref, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AlbumResult, ArtistResult, PlaylistResult, TrackResult } from "./content";
import { SearchInputRef } from "@mahiru/ui/common/components/page/search/input/SearchInput";
import { NeteaseHistory, NeteaseTrackRecord } from "@mahiru/ui/common/source/netease/models";
import { NeteaseImageSize } from "@mahiru/ui/common/enum";
import { HeartManager } from "@mahiru/ui/common/hooks/useHeart";
import { TrackListPlayableManager } from "@mahiru/ui/common/components/track_list";
import { TrackResultRef } from "@mahiru/ui/common/components/page/search/content/TrackResult";

import SearchInput from "./input";
import HotRecommend from "./HotRecommend";

export type SearchRef = {
  tracks: NeteaseTrackRecord[];
};

interface SearchProps {
  ref?: Ref<SearchRef>;
  className?: string;
  defaultKeyword: Optional<string>;
  onJumpAlbum: Optional<NormalFunc<[id: number]>>;
  onJumpArtist: Optional<NormalFunc<[id: number]>>;
  onJumpPlaylist: Optional<NormalFunc<[id: number]>>;
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

const Search: FC<SearchProps> = ({
  ref,
  className,
  defaultKeyword,
  onJumpPlaylist,
  onJumpArtist,
  onJumpAlbum,
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
  const inputRef = useRef<SearchInputRef>(null);
  const [trackListMounted, setTrackListMounted] = useState(false);
  const [albumListMounted, setAlbumListMounted] = useState(false);
  const [artistListMounted, setArtistListMounted] = useState(false);
  const [playlistListMounted, setPlaylistListMounted] = useState(false);
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
        />
      )}
      {albumListMounted && (
        <AlbumResult
          className={cx("flex-1", (tabs !== "albums" || !keyword) && "hidden")}
          keywords={keyword}
          onJumpAlbum={onJumpAlbum}
        />
      )}
      {artistListMounted && (
        <ArtistResult
          className={cx("flex-1", (tabs !== "artists" || !keyword) && "hidden")}
          keywords={keyword}
          onJumpArtist={onJumpArtist}
        />
      )}
      {playlistListMounted && (
        <PlaylistResult
          className={cx("flex-1", (tabs !== "playlists" || !keyword) && "hidden")}
          keywords={keyword}
          onJumpPlaylist={onJumpPlaylist}
        />
      )}
    </div>
  );
};

export default memo(Search);
