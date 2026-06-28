import { type FC, Fragment, memo } from "react";
import { cx } from "@emotion/css";
import { NeteaseTrackRecord } from "@/common/netease/models";

interface ListItemNameProps {
  track: NeteaseTrackRecord;
  disabled: boolean;
  onClick?: NormalFunc;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
  type: "album" | "history" | "like" | "normal";
}

const TrackItemName: FC<ListItemNameProps> = ({
  track,
  disabled,
  onClick,
  onClickArtist,
  onClickAlbum,
  type
}) => {
  const translateAndAliaName = track.detail.translateAndAliaName();
  return (
    <div className="flex min-w-0 flex-col gap-0.5 overflow-hidden">
      {/*歌曲标题*/}
      <div className="min-w-0 overflow-hidden truncate text-[15px] leading-5">
        <span
          className={cx(
            "cursor-pointer truncate select-none font-semibold transition-opacity duration-200 ease-in-out hover:opacity-60 active:scale-95",
            disabled && "cursor-not-allowed! opacity-50"
          )}
          onClick={() => !disabled && onClick?.()}>
          {track.detail.name}
        </span>
        {translateAndAliaName && (
          <span
            className={cx("ml-2 w-2 overflow-hidden truncate text-[13px] font-medium opacity-70")}>
            ({translateAndAliaName})
          </span>
        )}
      </div>
      {/*歌手、专辑*/}
      <div
        className={cx(
          "flex min-w-0 overflow-hidden truncate text-[13px] leading-4 font-medium opacity-70 select-none",
          disabled && "cursor-not-allowed! opacity-40"
        )}>
        <span className="min-w-0 truncate space-x-0.5">
          {track.detail.ar.map((ar, index) => {
            return (
              <Fragment key={ar.name + ar.id}>
                <span
                  className="inline-block cursor-pointer transition-all duration-200 ease-in-out hover:opacity-60 active:scale-98"
                  onClick={() => onClickArtist?.(ar.id)}>
                  {ar.name}
                </span>
                {index < track.detail.ar.length - 1 && <span className="inline-block">/</span>}
              </Fragment>
            );
          })}
        </span>
        {type !== "album" && (
          <>
            <span className="mx-2 shrink-0 opacity-60">-</span>
            <span
              className="min-w-0 truncate cursor-pointer transition-all duration-200 ease-in-out hover:opacity-60 active:scale-98"
              onClick={() => onClickAlbum?.(track.detail.al.id)}>
              {track.detail.al.name}
            </span>
          </>
        )}
      </div>
    </div>
  );
};
export default memo(TrackItemName);
