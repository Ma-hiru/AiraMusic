import { cx } from "@emotion/css";
import { memo, useCallback } from "react";
import { NeteaseHistoryRecord, NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";
import type {
  TrackListClickFunc,
  TrackListContextMenuFunc
} from "@/common/components/display/track_list";
import AppToast from "@/common/components/display/toast";

import ListItemIndex from "./idx";
import ListItemCover from "./cover";
import ListItemName from "./name";
import ListItemInfo from "./info";

export interface TrackItemLikeChangeFunc<
  T extends NeteaseTrackRecord | NeteaseHistoryRecord = NeteaseTrackRecord | NeteaseHistoryRecord
> {
  (track: T, index: number): void;
}

export interface TrackItemProps<
  T extends NeteaseTrackRecord | NeteaseHistoryRecord = NeteaseTrackRecord | NeteaseHistoryRecord
> {
  track: T;
  total: number;
  index: number;
  playable: boolean;
  reason: string;
  fastLocation: boolean;
  active: boolean;
  liked: boolean;
  onClick: Optional<TrackListClickFunc<T>>;
  onContext: Optional<TrackListContextMenuFunc<T>>;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  onLikeChange: Optional<TrackItemLikeChangeFunc<T>>;
  type: "album" | "history" | "like" | "normal";
  trackCoverSize: NeteaseImageSize;
  /** 批量选择模式：整行点击切换勾选，禁用播放/跳转 */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: NormalFunc;
}

const TrackItem = <T extends NeteaseTrackRecord | NeteaseHistoryRecord>({
  track,
  total,
  index,
  fastLocation,
  active,
  liked,
  onClick,
  onContext,
  onLikeChange,
  onClickArtist,
  onClickAlbum,
  type,
  playable,
  reason,
  trackCoverSize,
  selectionMode,
  selected,
  onToggleSelect
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
      onContextMenu={(e) => !selectionMode && playable && onContext?.(e, track, index)}
      onClick={playable || selectionMode ? undefined : showDisableReason}
      className={cx(
        `
            relative items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4
            rounded-md py-0.5 pl-2 mb-2
            ease-in-out transition-colors
        `,
        active
          ? "bg-primary text-primary-text shadow-xs"
          : selected
            ? "bg-secondary/15"
            : "hover:bg-black/10 active:bg-black/20",
        !playable && !selectionMode && "cursor-not-allowed! opacity-50"
      )}>
      {/* 选择模式下的整行点击层 */}
      {selectionMode && (
        <button
          type="button"
          aria-label="选择歌曲"
          onClick={() => onToggleSelect?.()}
          className="absolute inset-0 z-10 cursor-pointer"
        />
      )}
      {/*序号*/}
      <ListItemIndex
        total={total}
        active={active}
        disabled={!playable}
        index={index}
        onClick={() => onClick?.(track, index)}
        selectionMode={selectionMode}
        selected={selected}
      />
      {/*封面*/}
      {type !== "album" && (
        <ListItemCover
          track={track}
          onClick={() => onClick?.(track, index)}
          disabled={!playable}
          fastLocation={fastLocation}
          trackCoverSize={trackCoverSize}
        />
      )}
      {/*名称*/}
      <ListItemName
        track={track}
        type={type}
        disabled={!playable}
        onClick={() => onClick?.(track, index)}
        onClickAlbum={onClickAlbum}
        onClickArtist={onClickArtist}
      />
      {/*信息*/}
      <ListItemInfo
        active={active}
        disabled={!playable}
        track={track}
        liked={liked}
        onLikeChange={() => onLikeChange?.(track, index)}
        type={type}
      />
    </div>
  );
};

export default memo(TrackItem) as typeof TrackItem;
