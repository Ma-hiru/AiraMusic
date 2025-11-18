import { FC, memo, useMemo } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { mapTrackPlayableStatus } from "@mahiru/ui/api/utils/common";
import { formatDurationToMMSS, formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { getLyric, getMP3 } from "@mahiru/ui/api/track";
import ListItem from "@mahiru/ui/page/playlist/ListItem";
import { css, cx } from "@emotion/css";
import Search from "@mahiru/ui/page/playlist/Search";

interface ListProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const List: FC<ListProps> = ({ detail }) => {
  const tracks = useMemo(() => {
    if (!detail) return [];
    return mapTrackPlayableStatus(detail.playlist.tracks, detail.privileges);
  }, [detail]);
  return (
    <>
      <Search />
      <div
        className={cx(
          "space-y-2 w-full overflow-y-auto h-[calc(100%-216px)] pb-12",
          css`
            scrollbar-width: none;
          `
        )}>
        {tracks.map((track, index) => (
          <ListItem track={track} index={index + 1} key={track.id} />
        ))}
        <div className="text-[#7b8290]/50 text-[12px] font-medium text-center mt-4">
          一共 {detail?.playlist.tracks.length} 首音乐
        </div>
      </div>
    </>
  );
};
export default memo(List);
