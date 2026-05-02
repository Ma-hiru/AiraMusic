import { FC, Fragment, memo } from "react";
import { css, cx } from "@emotion/css";
import { ColorInstance } from "color";
import { NeteaseTrackRecord } from "@mahiru/ui/public/source/netease/models";

interface ListItemNameProps {
  track: NeteaseTrackRecord;
  disabled: boolean;
  textColor: ColorInstance;
  onClick?: NormalFunc;
  onClickArtist: Optional<NormalFunc<[id: number]>>;
  onClickAlbum: Optional<NormalFunc<[id: number]>>;
}

const TrackItemName: FC<ListItemNameProps> = ({
  track,
  disabled,
  onClick,
  textColor,
  onClickArtist,
  onClickAlbum
}) => {
  const translateAndAliaName = track.detail.translateAndAliaName();
  return (
    <div className="flex flex-col text-[14px] overflow-hidden">
      {/*歌曲标题*/}
      <div className="overflow-hidden flex-row truncate">
        <span
          className={cx(
            "cursor-pointer font-bold hover:opacity-50 ease-in-out duration-300 transition-all truncate select-none active:scale-95",
            disabled && "cursor-not-allowed! opacity-50",
            css`
              color: ${textColor.string()};
            `
          )}
          onClick={() => !disabled && onClick?.()}>
          {track.detail.name}
        </span>
        {translateAndAliaName && (
          <span
            className={cx(
              "w-2 overflow-hidden ml-2 ease-in-out duration-300 transition-all truncate select-none",
              css`
                color: ${textColor.alpha(0.3).string()};
              `
            )}>
            ({translateAndAliaName})
          </span>
        )}
      </div>
      {/*歌手、专辑*/}
      <div
        className={cx(
          "text-[12px] flex overflow-hidden gap-2 truncate select-none",
          disabled && "cursor-not-allowed! opacity-50",
          css`
            color: ${textColor.alpha(0.6).string()};
          `
        )}>
        <span className="truncate space-x-0.5">
          {track.detail.ar.map((ar, index) => {
            return (
              <Fragment key={ar.id}>
                <span
                  className="inline-block cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-95"
                  onClick={() => onClickArtist?.(ar.id)}>
                  {ar.name}
                </span>
                {index < track.detail.ar.length - 1 && <span className="inline-block">/</span>}
              </Fragment>
            );
          })}
        </span>
        <span>-</span>
        <span
          className="truncate cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-95"
          onClick={() => onClickAlbum?.(track.detail.al.id)}>
          {track.detail.al.name}
        </span>
      </div>
    </div>
  );
};
export default memo(TrackItemName);
