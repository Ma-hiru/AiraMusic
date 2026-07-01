import { cx } from "@emotion/css";
import { memo, useCallback } from "react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseTrackRecord, NeteaseHistoryRecord } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";
import type {
  TrackListClickFunc,
  TrackListContextMenuFunc
} from "@/common/components/display/track_list";

import ListItemIndex from "./idx";
import ListItemInfo from "./info";
import ListItemName from "./name";
import ListItemCover from "./cover";

export interface TrackItemLikeChangeFunc<
  T extends NeteaseTrackRecord | NeteaseHistoryRecord = NeteaseTrackRecord | NeteaseHistoryRecord
> {
  (track: T, index: number): void;
}

export interface TrackItemProps<
  T extends NeteaseTrackRecord | NeteaseHistoryRecord = NeteaseTrackRecord | NeteaseHistoryRecord
> {
  track: T;
  index: number;
  total: number;
  liked: boolean;
  reason: string;
  active: boolean;
  playable: boolean;
  fastLocation: boolean;
  trackCoverSize: NeteaseImageSize;
  type: "like" | "album" | "normal" | "history";
  onClick: Optional<TrackListClickFunc<T>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  onContext: Optional<TrackListContextMenuFunc<T>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onLikeChange: Optional<TrackItemLikeChangeFunc<T>>;
  /** 批量选择模式：整行点击切换勾选，禁用播放/跳转 */
  selected?: boolean;
  selectionMode?: boolean;
  onToggleSelect?: NormalFunc;
}

const TrackItem = <T extends NeteaseTrackRecord | NeteaseHistoryRecord>({
  onClick,
  onContext,
  onClickAlbum,
  onLikeChange,
  onClickArtist,
  onToggleSelect,
  type,
  index,
  liked,
  total,
  track,
  active,
  reason,
  playable,
  selected,
  fastLocation,
  selectionMode,
  trackCoverSize
}: TrackItemProps<T>) => {
  const showDisableReason = useCallback(() => {
    if (playable) return;
    AppToast.show({
      type: "info",
      text: reason
    });
  }, [playable, reason]);

  return (
    <div
      className={cx(
        `
            relative items-center grid grid-row-1 gap-3
            rounded-md mb-1.5 py-1 pl-2 pr-2
            ease-in-out transition-colors
        `,
        type === "album"
          ? "grid-cols-[auto_minmax(0,1fr)_auto]"
          : "grid-cols-[auto_auto_minmax(0,1fr)_auto]",
        active
          ? "bg-primary text-primary-text shadow-xs"
          : selected
            ? "bg-secondary/15"
            : "hover:bg-black/10 active:bg-black/20",
        !playable && !selectionMode && "cursor-not-allowed! opacity-50"
      )}
      onClick={playable || selectionMode ? undefined : showDisableReason}
      onContextMenu={(e) => !selectionMode && playable && onContext?.(e, track, index)}>
      {/* 选择模式下的整行点击层 */}
      {selectionMode && (
        <button
          className="absolute inset-0 z-10 cursor-pointer"
          type="button"
          aria-label="选择歌曲"
          title={track.name}
          onClick={() => onToggleSelect?.()}
        />
      )}
      {/*序号*/}
      <ListItemIndex
        index={index}
        total={total}
        active={active}
        selected={selected}
        disabled={!playable}
        selectionMode={selectionMode}
        onClick={() => onClick?.(track, index)}
      />
      {/*封面*/}
      {type !== "album" && (
        <ListItemCover
          track={track}
          disabled={!playable}
          fastLocation={fastLocation}
          trackCoverSize={trackCoverSize}
          onClick={() => onClick?.(track, index)}
        />
      )}
      {/*名称*/}
      <ListItemName
        type={type}
        track={track}
        disabled={!playable}
        onClickAlbum={onClickAlbum}
        onClickArtist={onClickArtist}
        onClick={() => onClick?.(track, index)}
      />
      {/*信息*/}
      <ListItemInfo
        type={type}
        liked={liked}
        track={track}
        active={active}
        disabled={!playable}
        onLikeChange={() => onLikeChange?.(track, index)}
      />
    </div>
  );
};

export default memo(TrackItem) as typeof TrackItem;
