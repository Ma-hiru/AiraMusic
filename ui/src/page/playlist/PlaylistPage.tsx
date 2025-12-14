import { FC, useCallback, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { usePlaylistNormalRender } from "@mahiru/ui/hook/usePlaylistRender";

import Top from "./top";
import List from "@mahiru/ui/componets/track_list";
import Divider from "./Divider";
import { ListContainerRef } from "@mahiru/ui/componets/track_list/List";
import { useLayoutStatus } from "@mahiru/ui/store";

const PlaylistPage: FC<object> = () => {
  // 获取路由参数id
  const { id } = useParams();
  console.log("Render PlayListPage", id);
  const { requestCanScrollTop } = useLayoutStatus(["requestCanScrollTop"]);
  const listRef = useRef<ListContainerRef>(null);

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
      <Top entry={entry} searchTracks={searchTracks} />
      <Divider />
      <div className="w-full h-[calc(100%-210px)] relative">
        <List
          ref={listRef}
          entry={entry}
          loading={loading}
          id={Number(id)}
          filterTracks={filterTracks}
          requestMissedTracks={requestMissedTracks}
          onVirtualListRangeUpdate={wrapRangeUpdate}
        />
      </div>
    </div>
  );
};
export default PlaylistPage;
