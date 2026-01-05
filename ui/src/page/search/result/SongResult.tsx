import { FC, memo, useEffect, useState } from "react";
import Color from "color";
import { NeteaseTrack } from "@mahiru/ui/utils/track";

import TrackList from "@mahiru/ui/componets/track_list";

interface SongResultProps {
  ids: number[];
  themeSync: ThemeSync;
}

const SongResult: FC<SongResultProps> = ({ ids, themeSync }) => {
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
  return (
    <TrackList
      tracks={tracks}
      textColorOnMain={Color(themeSync.textColorOnMain)}
      mainColor={Color(themeSync.mainColor)}
      showHeart={false}
      overscan={5}
    />
  );
};
export default memo(SongResult);
