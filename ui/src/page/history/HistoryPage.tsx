import { FC, memo } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import { usePlayListHistory } from "@mahiru/ui/hook/usePlayList";
import List from "@mahiru/ui/componets/track_list";
import Top from "@mahiru/ui/page/history/Top";

const HistoryPage: FC<object> = () => {
  const { filterTracks, onVirtualListRangeUpdate, searchTracks, loading } = usePlayListHistory();
  const defaultBackground =
    filterTracks?.tracks[0]?.al.cachedPicUrl || filterTracks?.tracks[0]?.al.picUrl;
  usePlayingBackground(defaultBackground);
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Top filterTracks={filterTracks} searchTracks={searchTracks} loading={loading} />
      <List
        onVirtualListRangeUpdate={onVirtualListRangeUpdate}
        filterTracks={filterTracks}
        loading={loading}
        paddingBottom={80}
        entry={null}
      />
    </div>
  );
};
export default memo(HistoryPage);
