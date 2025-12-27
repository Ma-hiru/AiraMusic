import { FC, memo, useCallback, useRef } from "react";
import { SearchType } from "@mahiru/ui/api/search";
import { cx } from "@emotion/css";
import { useScrollAutoHide } from "@mahiru/ui/hook/useScrollAutoHide";
import SongResult from "@mahiru/ui/page/search/result/SongResult";
import SongResultSummary from "@mahiru/ui/page/search/result/SongResultSummary";

interface SearchResultProps {
  data: Nullable<NeteaseSearchResult<any>>;
  type: SearchType;
  setSearchType: NormalFunc<[type: SearchType]>;
  className?: string;
  themeSync: InfoSync<"theme">;
  requestResult: NormalFunc<[pageNo: number]>;
  currentPage: number;
  totalResult: number;
  totalPage: number;
}

const SearchResult: FC<SearchResultProps> = ({
  data,
  type,
  className,
  setSearchType,
  themeSync,
  totalPage,
  totalResult,
  requestResult,
  currentPage
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { onScroll } = useScrollAutoHide(containerRef);

  const nextPage = useCallback(() => {
    if (currentPage >= totalPage) return;
    requestResult(currentPage + 1);
  }, [currentPage, requestResult, totalPage]);

  const lastPage = useCallback(() => {
    if (currentPage <= 1) return;
    requestResult(currentPage - 1);
  }, [currentPage, requestResult]);

  function render() {
    if (!data) return null;
    switch (type) {
      case SearchType.COMPREHENSIVE: {
        const comprehensive = data as NeteaseSearchResult<"all">;
        return (
          <div>
            <h2>songs:</h2>
            <SongResultSummary
              ids={comprehensive.song.songs.map((song) => song.id)}
              themeSync={themeSync}
            />
            {comprehensive.song.moreText}
            <h2>album</h2>
            {comprehensive.album.albums.map((al) => {
              return (
                <div key={al.id}>
                  {al.name} - {al.artists.map((ar) => ar.name).join(" / ")}
                </div>
              );
            })}
            {comprehensive.album.moreText}
            <h2>artist</h2>
            {comprehensive.artist.artists.map((ar) => {
              return <div key={ar.id}>{ar.name}</div>;
            })}
            {comprehensive.artist.moreText}
            <h2>playlist</h2>
            {comprehensive.playList.playLists.map((list) => {
              return (
                <div key={list.id}>
                  {list.name} - {list.creator.nickname}
                </div>
              );
            })}
            {comprehensive.playList.moreText}
          </div>
        );
      }
      case SearchType.SONG: {
        const songResult = data as NeteaseSearchResult<"song">;
        return (
          <div>
            <h2 onClick={nextPage}>
              songs({totalResult}):{currentPage} / {totalPage}
            </h2>
            <SongResult ids={songResult.songs.map((song) => song.id)} themeSync={themeSync} />
          </div>
        );
      }
      case SearchType.ALBUM: {
        const albumResult = data as NeteaseSearchResult<"album">;
        return (
          <div>
            <h2>
              album({totalResult}):{currentPage} / {totalPage}
            </h2>
            {albumResult.albums.map((al) => {
              return (
                <div key={al.id}>
                  {al.name} - {al.artists.map((ar) => ar.name).join(" / ")}
                </div>
              );
            })}
          </div>
        );
      }
      case SearchType.ARTIST: {
        const artistResult = data as NeteaseSearchResult<"artist">;
        return (
          <div>
            <h2>
              artist({totalResult}):{currentPage} / {totalPage}
            </h2>
            {artistResult.artists.map((ar) => {
              return <div key={ar.id}>{ar.name}</div>;
            })}
          </div>
        );
      }
      case SearchType.PLAYLIST: {
        const playlistResult = data as NeteaseSearchResult<"playlist">;
        return (
          <div>
            <h2>
              playlist({totalResult}):{currentPage} / {totalPage}
            </h2>
            {playlistResult.playlists.map((list) => {
              return (
                <div key={list.id}>
                  {list.name} - {list.creator.nickname}
                </div>
              );
            })}
          </div>
        );
      }
    }
  }

  return (
    <>
      <div className="flex gap-4 justify-center items-center">
        <span
          style={{
            color: type === SearchType.COMPREHENSIVE ? themeSync.value.mainColor : undefined
          }}
          className={cx("cursor-pointer")}
          onClick={() => {
            setSearchType(SearchType.COMPREHENSIVE);
          }}>
          All
        </span>
        <span
          style={{
            color: type === SearchType.SONG ? themeSync.value.mainColor : undefined
          }}
          className={cx("cursor-pointer")}
          onClick={() => {
            setSearchType(SearchType.SONG);
          }}>
          Song
        </span>
        <span
          style={{
            color: type === SearchType.ALBUM ? themeSync.value.mainColor : undefined
          }}
          className={cx("cursor-pointer")}
          onClick={() => {
            setSearchType(SearchType.ALBUM);
          }}>
          Album
        </span>
        <span
          style={{
            color: type === SearchType.ARTIST ? themeSync.value.mainColor : undefined
          }}
          className={cx("cursor-pointer")}
          onClick={() => {
            setSearchType(SearchType.ARTIST);
          }}>
          Artist
        </span>
        <span
          style={{
            color: type === SearchType.PLAYLIST ? themeSync.value.mainColor : undefined
          }}
          className={cx("cursor-pointer")}
          onClick={() => {
            setSearchType(SearchType.PLAYLIST);
          }}>
          Playlist
        </span>
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className={cx("w-full h-full overflow-y-scroll scrollbar pb-26", className)}>
        {render()}
      </div>
    </>
  );
};
export default memo(SearchResult);
