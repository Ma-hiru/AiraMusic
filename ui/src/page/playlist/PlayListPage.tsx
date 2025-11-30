import { FC } from "react";
import { useParams } from "react-router-dom";
import { usePlayListNormal } from "@mahiru/ui/hook/usePlayList";
import BlobCachedProvider from "@mahiru/ui/ctx/BlobCachedProvider";

import Top from "./top";
import List from "@mahiru/ui/componets/track_list";
import Divider from "./Divider";

const PlayListPage: FC<object> = () => {
  // 获取路由参数id
  const { id } = useParams();
  const { detail, searchTracks, onVirtualListRangeUpdate, filterTracks, loading } =
    usePlayListNormal(id);
  return (
    <div className="w-full h-full px-12 pt-20 contain-style contain-size contain-layout">
      <Top detail={detail} searchTracks={searchTracks} />
      <Divider />
      <BlobCachedProvider>
        <div className="w-full h-[calc(100%-210px)] relative">
          <List
            id={Number(id)}
            loading={loading}
            filterTracks={filterTracks}
            onVirtualListRangeUpdate={onVirtualListRangeUpdate}
          />
        </div>
      </BlobCachedProvider>
    </div>
  );
};
export default PlayListPage;
