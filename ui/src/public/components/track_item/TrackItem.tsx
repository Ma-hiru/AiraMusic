import { cx } from "@emotion/css";
import { FC, memo, MouseEvent as ReactMouseEvent, useCallback } from "react";
import { ColorInstance } from "color";
import {
  NeteaseHistory,
  NeteaseTrackRecord,
  NeteaseUser
} from "@mahiru/ui/public/source/netease/models";
import { PlaylistSource } from "@mahiru/ui/windows/main/constants";

import ListItemIndex from "./TrackItemIndex";
import ListItemCover from "./TrackItemCover";
import ListItemName from "./TrackItemName";
import ListItemInfo from "./TrackItemInfo";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import AppToast from "@mahiru/ui/public/components/toast";

export interface TrackItemProps {
  textColor: ColorInstance;
  mainColor: ColorInstance;
  track: NeteaseTrackRecord | NeteaseHistory;
  total: number;
  index: number;
  fastLocation: boolean;
  active: boolean;
  liked: boolean;
  onClick: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  onContext: Optional<
    NormalFunc<
      [
        e: ReactMouseEvent<HTMLDivElement, MouseEvent>,
        track: NeteaseTrackRecord | NeteaseHistory,
        index: number
      ]
    >
  >;
  onLikeChange: Optional<NormalFunc<[track: NeteaseTrackRecord | NeteaseHistory, index: number]>>;
  type: PlaylistSource;
  user: Optional<NeteaseUser>;
  trackCoverSize: NeteaseImageSize;
}

const TrackItem: FC<TrackItemProps> = ({
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
  type,
  user,
  trackCoverSize
}) => {
  const { playable, reason } = track.detail.playable(user);
  const showDisableReason = useCallback(() => {
    if (playable) return;
    AppToast.request({
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
      <ListItemCover
        track={track}
        onClick={() => onClick?.(track, index)}
        disabled={!playable}
        isMainColorDark={mainColor.isDark()}
        fastLocation={fastLocation}
        trackCoverSize={trackCoverSize}
      />
      {/*名称*/}
      <ListItemName
        track={track}
        textColor={textColor}
        disabled={!playable}
        onClick={() => onClick?.(track, index)}
      />
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

export default memo(TrackItem);
