import { FC, memo, useEffect } from "react";
import { usePlaylistHistoryRender } from "@mahiru/ui/hook/usePlaylistRender";
import TrackList from "@mahiru/ui/componets/track_list";
import Top from "@mahiru/ui/page/history/Top";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const HistoryPage: FC<object> = () => {
  const props = usePlaylistHistoryRender();
  const { PlayerTheme, UpdatePlayerTheme } = useLayoutStore(["PlayerTheme", "UpdatePlayerTheme"]);
  const defaultBackground = props.tracks[0]?.al.cachedPicUrl || props.tracks[0]?.al.picUrl;

  useEffect(() => {
    if (!PlayerTheme.BackgroundCover) {
      UpdatePlayerTheme({ BackgroundCover: defaultBackground });
    }
  }, [PlayerTheme.BackgroundCover, UpdatePlayerTheme, defaultBackground]);

  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Top recordCount={props.tracks.length} searchTracks={props.searchTracks} />
      <TrackList {...props} paddingBottom={80} />
    </div>
  );
};
export default memo(HistoryPage);
