import { FC, memo, useEffect } from "react";
import { usePlaylistHistoryRender } from "@mahiru/ui/hook/usePlaylistRender";
import TrackList from "@mahiru/ui/componets/track_list";
import Top from "@mahiru/ui/page/history/Top";
import { usePlayerStatus } from "@mahiru/ui/store";

const HistoryPage: FC<object> = () => {
  const props = usePlaylistHistoryRender();
  const { background, setBackground } = usePlayerStatus(["background", "setBackground"]);
  const defaultBackground = props.tracks[0]?.al.cachedPicUrl || props.tracks[0]?.al.picUrl;

  useEffect(() => {
    if (!background) setBackground(defaultBackground);
  }, [background, defaultBackground, setBackground]);

  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Top recordCount={props.tracks.length} searchTracks={props.searchTracks} />
      <TrackList {...props} paddingBottom={80} />
    </div>
  );
};
export default memo(HistoryPage);
