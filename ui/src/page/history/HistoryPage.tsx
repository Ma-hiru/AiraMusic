import { FC, memo, useEffect } from "react";
import { usePlaylistHistoryRender } from "@mahiru/ui/hook/usePlaylistRender";
import TrackList from "@mahiru/ui/componets/track_list";
import Top from "@mahiru/ui/page/history/Top";
import { usePlayerStatus } from "@mahiru/ui/store";

const HistoryPage: FC<object> = () => {
  const { filterTracks, historyTracks, onVirtualListRangeUpdate, searchTracks, loading } =
    usePlaylistHistoryRender();
  const { background, setBackground } = usePlayerStatus(["background", "setBackground"]);
  const defaultBackground =
    filterTracks?.tracks[0]?.al.cachedPicUrl || filterTracks?.tracks[0]?.al.picUrl;

  useEffect(() => {
    if (!background) {
      setBackground(defaultBackground);
    }
  }, [background, defaultBackground, setBackground]);
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Top filterTracks={filterTracks} searchTracks={searchTracks} loading={loading} />
      <TrackList
        onVirtualListRangeUpdate={onVirtualListRangeUpdate}
        filterTracks={filterTracks}
        rawTracks={historyTracks}
        loading={loading}
        paddingBottom={80}
        entry={null}
        requestMissedTracks={0}
      />
    </div>
  );
};
export default memo(HistoryPage);
