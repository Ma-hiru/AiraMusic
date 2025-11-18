import { FC, memo, useMemo } from "react";
import { NeteasePlaylistDetailResponse, NeteaseTrack } from "@mahiru/ui/types/netease-api";
import { mapTrackPlayableStatus } from "@mahiru/ui/api/utils/common";
import { formatDurationToMMSS, formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { getLyric, getMP3 } from "@mahiru/ui/api/track";

interface ListProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
}

const List: FC<ListProps> = ({ detail }) => {
  const tracks = useMemo(() => {
    if (!detail) return [];
    return mapTrackPlayableStatus(
      detail.playlist.tracks,
      detail.privileges
    ) as unknown as (NeteaseTrack & {
      playable: boolean;
      reason: string;
    })[];
  }, [detail]);
  return (
    <div className="space-y-2">
      {tracks.map((track) => {
        return (
          <div key={track.id} className="flex gap-4" onClick={() => {}}>
            <img src={track.al.picUrl} className="size-6" alt={track.al.name} />
            <span>
              {track.name}({track.tns?.[0] || track.alia?.[0]})
            </span>
            <span>{track.ar.map((ar) => ar.name).join("-")}</span>
            <span>{track.al.name}</span>
            <span>
              {track.playable ? "可播放" : "不可播放"}-{track.reason}
            </span>
            <span>{formatTimeToMMDD(track.publishTime)}</span>
            <span>时长:{formatDurationToMMSS(track.dt)}</span>
            <button
              onClick={() => {
                requestLyric(track.id);
              }}>
              get lyric
            </button>
            <button
              onClick={() => {
                requestTrackURL(track.id);
              }}>
              get url
            </button>
          </div>
        );
      })}
    </div>
  );
};
export default memo(List);

async function requestLyric(trackId: number) {
  const result = await getLyric(trackId);
  console.log("lyric", result);
}

async function requestTrackURL(trackId: number) {
  const result = await getMP3(trackId);
  console.log("track url", result);
}
