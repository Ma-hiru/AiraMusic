import { FC, memo, useLayoutEffect, useMemo, useState } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { mapTrackPlayableStatus } from "@mahiru/ui/api/utils/common";
import ListItem from "@mahiru/ui/page/playlist/ListItem";
import { css, cx } from "@emotion/css";
import Search from "@mahiru/ui/page/playlist/Search";
import { List, RowComponentProps } from "react-window";

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
  return (
    <>
      <Search />
      <div
        className={cx(
          "space-y-2 w-full overflow-y-auto h-[calc(100%-216px)] pb-8",
          css`
            scrollbar-width: none;
          `
        )}>
        <List
          className={cx(
            "w-full h-full",
            css`
              scrollbar-width: none;
            `
          )}
          rowComponent={RowComponent}
          rowCount={tracks.length}
          rowProps={{ tracks }}
          rowHeight={50}
          overscanCount={5}
        />
      </div>
    </>
  );
};
export default memo(PlayList);

function RowComponent(
  props: RowComponentProps<{
    tracks: NeteaseTrack[];
  }>
) {
  const { index, style, tracks } = props;
  return (
    <div style={style} className="overflow-hidden">
      <ListItem track={tracks[index]!} index={index + 1} />
    </div>
  );
}
