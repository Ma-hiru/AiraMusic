import { FC } from "react";
import { useParams } from "react-router-dom";
import { usePlayListNormal } from "@mahiru/ui/hook/usePlayList";

import Top from "./top";
import List from "@mahiru/ui/componets/track_list";
import Divider from "./Divider";

const PlayListPage: FC<object> = () => {
  // 获取路由参数id
  const { id } = useParams();
  const {
    entry,
    searchTracks,
    onVirtualListRangeUpdate,
    filterTracks,
    loading,
    requestMissedTracks
  } = usePlayListNormal(id);
  return (
    <div className="w-full h-full px-12 pt-20 contain-style contain-size contain-layout">
      <Top entry={entry} searchTracks={searchTracks} />
      <Divider />
      <div className="w-full h-[calc(100%-210px)] relative">
        <List
          entry={entry}
          loading={loading}
          id={Number(id)}
          filterTracks={filterTracks}
          requestMissedTracks={requestMissedTracks}
          onVirtualListRangeUpdate={onVirtualListRangeUpdate}
        />
      </div>
    </div>
  );
};
export default PlayListPage;
