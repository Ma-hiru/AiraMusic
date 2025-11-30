import { FC, memo } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import { usePlayListHistory } from "@mahiru/ui/hook/usePlayList";
import List from "@mahiru/ui/componets/track_list";

const HistoryPage: FC<object> = () => {
  usePlayingBackground();
  const { filterTracks, onVirtualListRangeUpdate, searchTracks } = usePlayListHistory();
  return (
    <div className="w-full h-full px-12 pt-20">
      <List onVirtualListRangeUpdate={onVirtualListRangeUpdate} filterTracks={filterTracks} />
    </div>
  );
};
export default memo(HistoryPage);
