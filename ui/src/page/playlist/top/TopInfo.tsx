import { FC, memo, useCallback, useEffect } from "react";

import { ListMusic, MessageSquare, Play } from "lucide-react";

import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { Time } from "@mahiru/ui/utils/time";
import { Player } from "@mahiru/ui/utils/player";
import { useInfoWindow } from "@mahiru/ui/hook/useInfoWindow";
import { CommentType } from "@mahiru/ui/api/comment";

interface TopInfoProps {
  id?: number;
  entry: Nullable<PlaylistCacheEntry>;
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: Nullable<number[]> };
}

const TopInfo: FC<TopInfoProps> = ({ entry, filterTracks, id }) => {
  const { textColorOnMain, mainColor } = useThemeColor();
  const { openInfoWindow, opened, commentsDisplayType } = useInfoWindow();

  const openComments = useCallback(() => {
    entry?.playlist &&
      openInfoWindow("comments", {
        type: CommentType.Playlist,
        id: id || 0,
        playlist: entry?.playlist
      });
  }, [entry?.playlist, id, openInfoWindow]);

  useEffect(() => {
    if (opened && commentsDisplayType === "subscribe" && entry?.playlist) {
      openComments();
    }
  }, [commentsDisplayType, entry?.playlist, openComments, opened]);
  return (
    <div className="h-44 grid grid-cols-1 grid-rows-[auto_1fr_auto] overflow-hidden max-w-max">
      <div
        style={{ color: textColorOnMain.hex() }}
        className="inline-block font-bold text-[26px] overflow-hidden truncate ease-in-out duration-300 transition-all">
        {entry?.playlist.name || ""}
      </div>
      <div
        style={{ color: textColorOnMain.alpha(0.8).string() }}
        className="grid grid-rows-[1fr_auto] grid-cols-1 text-[12px] font-semibold overflow-hidden py-1">
        <div className="w-full h-full whitespace-pre-wrap overflow-hidden text-ellipsis line-clamp-3">
          {entry?.playlist.description || "暂无描述"}
        </div>
        <div className="flex flex-col">
          <span className="select-none">歌曲数量 {Number(entry?.playlist.trackCount) || "-"}</span>
          <span className="select-none">
            更新时间 {Time.formatTrackDate(entry?.playlist.trackUpdateTime) || "-"}
          </span>
        </div>
      </div>
      <div className="flex items-center">
        <button
          style={{ backgroundColor: mainColor.hex(), color: textColorOnMain.hex() }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60"
          onClick={() => {
            Player.replacePlaylist(filterTracks.tracks, id, 0);
          }}>
          <Play size={16} /> 全部播放
        </button>
        <button
          style={{ color: mainColor.hex(), backgroundColor: textColorOnMain.hex() }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60"
          onClick={() => {
            Player.addPlaylist(filterTracks.tracks, id);
          }}>
          <ListMusic size={16} /> 加入列表
        </button>
        <button
          style={{ color: mainColor.hex() }}
          className="px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60"
          onClick={openComments}>
          <MessageSquare size={16} /> 评论
        </button>
      </div>
    </div>
  );
};
export default memo(TopInfo);
