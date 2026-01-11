import { FC, memo, useEffect } from "react";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { usePlaylistHistoryRender } from "@mahiru/ui/main/hooks/usePlaylistRender";
import { NeteaseImage } from "@mahiru/ui/public/entry/image";

import Top from "./Top";
import TrackList from "@mahiru/ui/public/components/track_list";

const HistoryPage: FC<object> = () => {
  const props = usePlaylistHistoryRender();
  const { PlayerTheme, UpdatePlayerTheme } = useLayoutStore(["PlayerTheme", "UpdatePlayerTheme"]);
  const defaultBackground =
    NeteaseImage.fetchCacheURL(props.tracks[0]?.al.picUrl) || props.tracks[0]?.al.picUrl;

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
