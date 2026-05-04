import { cx } from "@emotion/css";
import { memo, useCallback } from "react";
import { ColorInstance } from "color";
import { NeteaseHistory, NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";
import { NeteaseImageSize, PlaylistSource } from "@mahiru/ui/public/enum";
import type {
  TrackListClickFunc,
  TrackListContextMenuFunc
} from "@mahiru/ui/public/components/track_list";
import AppToast from "@mahiru/ui/public/components/toast";

import ListItemIndex from "./TrackItemIndex";
import ListItemCover from "./TrackItemCover";
import ListItemName from "./TrackItemName";
import ListItemInfo from "./TrackItemInfo";

export interface TrackItemLikeChangeFunc<
  T extends NeteaseTrackRecord | NeteaseHistory = NeteaseTrackRecord | NeteaseHistory
> {
  (track: T, index: number): void;
}

export interface TrackItemProps<
  T extends NeteaseTrackRecord | NeteaseHistory = NeteaseTrackRecord | NeteaseHistory
> {
  textColor: ColorInstance;
  mainColor: ColorInstance;
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
  type: PlaylistSource;
  trackCoverSize: NeteaseImageSize;
}

const TrackItem = <T extends NeteaseTrackRecord | NeteaseHistory>({
  textColor,
  mainColor,
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
      onContextMenu={(e) => playable && onContext?.(e, track, index)}
      style={active ? { color: textColor.string() } : undefined}
      onClick={playable ? undefined : showDisableReason}
      className={cx(
        `
            items-center grid grid-row-1 grid-cols-[auto_auto_1fr_auto_auto] gap-4
            rounded-md py-0.5 pl-2 mb-2
            ease-in-out transition-colors
        `,
        active ? "bg-(--theme-color-main) shadow-xs" : "hover:bg-black/10 active:bg-black/20",
        !playable && "cursor-not-allowed! opacity-50"
      )}>
      {/*序号*/}
      <ListItemIndex
        total={total}
        color={textColor.alpha(0.8).string()}
        active={active}
        disabled={!playable}
        index={index}
        onClick={() => onClick?.(track, index)}
      />
      {/*封面*/}
      {type !== PlaylistSource.Album && (
        <ListItemCover
          track={track}
          onClick={() => onClick?.(track, index)}
          disabled={!playable}
          isMainColorDark={mainColor.isDark()}
          fastLocation={fastLocation}
          trackCoverSize={trackCoverSize}
        />
      )}
      {/*名称*/}
      <ListItemName
        track={track}
        type={type}
        textColor={textColor}
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
        mainColor={mainColor}
        textColor={textColor}
        liked={liked}
        onLikeChange={() => onLikeChange?.(track, index)}
        type={type}
      />
    </div>
  );
};

export default memo(TrackItem) as typeof TrackItem;
