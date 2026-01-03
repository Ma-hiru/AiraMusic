import Color from "color";
import { FC, memo, useEffect, useState } from "react";
import { NeteaseTrack } from "@mahiru/ui/utils/track";

import TrackItem from "@mahiru/ui/componets/track_item/TrackItem";

interface SongResultProps {
  ids: number[];
  themeSync: InfoSync<"theme">;
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
        textColorOnMain={Color(themeSync.value.textColor)}
        mainColor={Color(themeSync.value.mainColor)}
        showHeart={false}
      />
    );
  });
};
export default memo(SongResultSummary);
