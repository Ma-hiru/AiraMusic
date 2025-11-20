import { FC, memo, useCallback } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { css, cx } from "@emotion/css";
import { Virtuoso } from "react-virtuoso";
import ListItem from "@mahiru/ui/page/playlist/ListItem";

interface ListProps {
  filterTracks: NeteasePlaylistDetailResponse["playlist"]["tracks"];
}

const PlayList: FC<ListProps> = ({ filterTracks }) => {
  const RowComponent = useCallback(
    (index: number, data: NeteaseTrack) => {
      return <ListItem track={data} index={index + 1} total={filterTracks.length} />;
    },
    [filterTracks]
  );
  return (
    <div
      className={cx(
        "w-full overflow-y-auto h-[calc(100%-210px)]",
        css`
          scrollbar-width: none;
        `
      )}>
      {filterTracks.length > 200 ? (
        <Virtuoso<NeteaseTrack>
          className={cx(css`
            scrollbar-width: none;
          `)}
          data={filterTracks}
          itemContent={RowComponent}
          overscan={5}
        />
      ) : (
        filterTracks.map((track, index) => (
          <ListItem key={track.id} track={track} index={index + 1} total={filterTracks.length} />
        ))
      )}
    </div>
  );
};
export default memo(PlayList);
