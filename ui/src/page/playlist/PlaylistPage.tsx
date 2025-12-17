import { FC, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { usePlaylistNormalRender } from "@mahiru/ui/hook/usePlaylistRender";

import Top from "./top";
import Divider from "./Divider";
import TrackList, { TrackListRef } from "@mahiru/ui/componets/track_list";
import { useLayoutStatus } from "@mahiru/ui/store";

const PlaylistPage: FC<object> = () => {
  // 获取路由参数id
  const { id } = useParams();
  const { requestCanScrollTop } = useLayoutStatus(["requestCanScrollTop"]);
  const listRef = useRef<TrackListRef>(null);

  const {
    entry,
    searchTracks,
    onVirtualListRangeUpdate,
    filterTracks,
    loading,
    requestMissedTracks
  } = usePlaylistNormalRender(id);

  const scrollTop = useCallback(() => {
    listRef.current?.containerRef.current?.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }, []);

  const wrapRangeUpdate = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5) requestCanScrollTop("playlist", scrollTop);
      else requestCanScrollTop("none");
      return onVirtualListRangeUpdate(range);
    },
    [onVirtualListRangeUpdate, requestCanScrollTop, scrollTop]
  );

  useEffect(() => {
    return () => {
      requestCanScrollTop("none");
    };
  }, [requestCanScrollTop]);

  return (
    <div className="w-full h-full px-12 pt-20 contain-style contain-size contain-layout">
      <Top entry={entry} filterTracks={filterTracks} searchTracks={searchTracks} />
      <Divider />
      <div className="w-full h-[calc(100%-210px)] relative">
        <TrackList
          ref={listRef}
          entry={entry}
          loading={loading}
          id={id ? Number(id) : undefined}
          filterTracks={filterTracks}
          requestMissedTracks={requestMissedTracks}
          onVirtualListRangeUpdate={wrapRangeUpdate}
        />
      </div>
    </div>
  );
};
export default PlaylistPage;
