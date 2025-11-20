import { FC, memo, useCallback, useLayoutEffect, useState } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { mapTrackPlayableStatus } from "@mahiru/ui/api/utils/common";
import { css, cx } from "@emotion/css";
import { Virtuoso } from "react-virtuoso";
import ListItem from "@mahiru/ui/page/playlist/ListItem";
import Search from "@mahiru/ui/page/playlist/Search";

interface ListProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const PlayList: FC<ListProps> = ({ detail }) => {
  const [tracks, setTracks] = useState<NeteaseTrack[]>([]);
  useLayoutEffect(() => {
    if (detail) {
      setTracks(mapTrackPlayableStatus(detail.playlist.tracks, detail.privileges));
    }
  }, [detail]);
  const RowComponent = useCallback(
    (index: number, data: NeteaseTrack) => {
      return <ListItem track={data} index={index + 1} total={tracks.length} />;
    },
    [tracks]
  );
  return (
    <>
      <Search />
      <div
        className={cx(
          "w-full overflow-y-auto h-[calc(100%-216px)] pb-8",
          css`
            scrollbar-width: none;
          `
        )}>
        {tracks.length > 200 ? (
          <Virtuoso<NeteaseTrack>
            className={cx(
              "w-full h-full",
              css`
                scrollbar-width: none;
              `
            )}
            data={tracks}
            itemContent={RowComponent}
            overscan={5}
          />
        ) : (
          tracks.map((track, index) => (
            <ListItem key={track.id} track={track} index={index + 1} total={tracks.length} />
          ))
        )}
      </div>
    </>
  );
};
export default memo(PlayList);
