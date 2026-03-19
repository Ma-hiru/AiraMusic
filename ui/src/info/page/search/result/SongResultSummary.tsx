import Color from "color";
import { FC, memo, useEffect, useState } from "react";

import TrackItem from "@mahiru/ui/public/components/track_item";

interface SongResultProps {
  ids: number[];
  themeSync: ThemeSync;
}

const SongResultSummary: FC<SongResultProps> = ({ ids, themeSync }) => {
  const [tracks, setTracks] = useState<NeteaseTrack[]>([]);
  useEffect(() => {
    if (ids.length) {
      NeteaseTrack.requestTrackDetail(ids)
        .then((response) =>
          NeteaseTrack.tracksPrivilegeExtends(response.tracks, response.privilege)
        )
        .then(setTracks);
    }
  }, [ids]);
  return tracks.map((_, index) => {
    return (
      <TrackItem
        tracks={tracks}
        trackIdx={index}
        textColorOnMain={Color(themeSync.textColorOnMain)}
        mainColor={Color(themeSync.mainColor)}
        showHeart={false}
      />
    );
  });
};
export default memo(SongResultSummary);
