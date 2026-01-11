import { FC, memo, useCallback, useEffect, useRef } from "react";
import { ListMusic, MessageSquare, Play } from "lucide-react";
import { PlaylistCacheEntry } from "@mahiru/ui/public/entry/playlist";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useInfoWindow } from "@mahiru/ui/main/hooks/useInfoWindow";
import { CommentType } from "@mahiru/ui/public/enum";
import { Time } from "@mahiru/ui/public/entry/time";

interface TopInfoProps {
  entry: Nullable<PlaylistCacheEntry>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
}

const TopInfo: FC<TopInfoProps> = ({ entry, onPlayAll, onAddList }) => {
  const { textColorOnMain, mainColor } = useThemeColor();
  const { openInfoWindow, opened, commentsDisplayType } = useInfoWindow();
  const lastPlaylistID = useRef(entry?.playlist.id);

  const openComments = useCallback(
    (playlist?: NeteasePlaylistDetail) => {
      if (!playlist) return;
      openInfoWindow("comments", {
        type: CommentType.Playlist,
        id: playlist.id,
        playlist
      });
    },
    [openInfoWindow]
  );

  useEffect(() => {
    if (
      opened &&
      commentsDisplayType === "subscribe" &&
      entry?.playlist.id !== lastPlaylistID.current
    ) {
      openComments(entry?.playlist);
      lastPlaylistID.current = entry?.playlist.id;
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
          onClick={onPlayAll}>
          <Play size={16} /> 全部播放
        </button>
        <button
          style={{ color: mainColor.hex(), backgroundColor: textColorOnMain.hex() }}
          className="rounded-md px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 overflow-hidden active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60"
          onClick={onAddList}>
          <ListMusic size={16} /> 加入列表
        </button>
        <button
          style={{ color: mainColor.hex() }}
          onClick={() => openComments(entry?.playlist)}
          className="overflow-hidden px-2 py-1 text-[12px] mr-2 cursor-pointer font-semibold flex items-center gap-1 active:scale-95 shadow-2xl select-none min-w-max ease-in-out duration-300 transition-all hover:opacity-60 space-x-0.5">
          <MessageSquare size={16} />
          <span>评论</span>
          <span>{commentPosition(entry?.playlist.commentCount)}</span>
        </button>
      </div>
    </div>
  );
};
export default memo(TopInfo);

function commentPosition(count?: number) {
  if (!count) {
    return "";
  }
  if (count > 999) {
    return "999+";
  } else {
    return count.toString();
  }
}
