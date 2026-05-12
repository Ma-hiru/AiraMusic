import { cx } from "@emotion/css";
import { FC, memo, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NeteaseArtist } from "@mahiru/ui/public/source/netease/models";
import { FormatNumber } from "../../../../lib/format";
import { NeteaseAPIArtist } from "@mahiru/ui/public/source/netease/api";
import AppToast from "@mahiru/ui/public/components/toast";

interface InfoProps {
  className?: string;
  artist: Nullable<NeteaseArtist>;
  children?: ReactNode;
}

const Info: FC<InfoProps> = ({ className, artist, children }) => {
  const split = " / ";
  const artistName = artist?.detail.artist.name ?? "-";
  const alias = useMemo(() => {
    const alias = artist?.detail.artist.alias ?? [];
    const transNames = artist?.detail.artist.transNames ?? [];
    return transNames.concat(alias).join(split);
  }, [artist?.detail.artist.alias, artist?.detail.artist.transNames]);
  const [hasFollowedDays, setHasFollowedDays] = useState("");

  const [followed, setFollowed] = useState(artist?.followInfos.follow ?? false);
  const [fansCount, setFansCount] = useState(artist?.followInfos.fansCnt ?? 0);
  const loading = useRef(false);
  const follow = useCallback(() => {
    if (!artist?.id) return;
    if (loading.current) return;
    setFollowed(!followed);
    setFansCount(fansCount + (followed ? -1 : 1));
    // 取消关注时，清空关注天数
    if (followed) setHasFollowedDays("");

    loading.current = true;
    NeteaseAPIArtist.subscribe(artist.id, !followed)
      .then(() => {
        AppToast.show({
          type: "success",
          text: followed ? "取消关注成功" : "关注成功"
        });
      })
      .finally(() => {
        loading.current = false;
      });
  }, [artist?.id, fansCount, followed]);

  const followText = useMemo(() => {
    if (!followed) return "关注";
    if (hasFollowedDays) return hasFollowedDays;
    return "已关注";
  }, [followed, hasFollowedDays]);

  useEffect(() => {
    setHasFollowedDays(artist?.followInfos.followDay ?? "");
  }, [artist?.followInfos.followDay]);

  return (
    <div
      className={cx(
        "flex flex-col items-start justify-start text-(--text-color-on-main)",
        className
      )}>
      <div
        className={cx(
          "relative inline-flex flex-col items-start text-3xl font-bold",
          alias && "pt-5"
        )}>
        {alias && (
          <h2 className="absolute left-0 top-0 w-full truncate text-center text-sm font-semibold opacity-70 select-all">
            {alias}
          </h2>
        )}
        <h1 className="whitespace-nowrap select-all">{artistName}</h1>
      </div>
      <div className="text-sm inline-block font-light select-all mt-auto">
        <span> 粉丝: {FormatNumber.count(fansCount)}</span>
        <span className="ml-2 mr-1">/</span>
        <button
          onClick={follow}
          className={cx(`
            text-sm font-light cursor-pointer px-2 py-1 rounded-md
            hover:bg-(--theme-color-main)/20 hover:text-(--text-color-on-main)
            active:bg-(--theme-color-main)/50
            transition-all duration-300 ease-in-out
        `)}>
          {followText}
        </button>
      </div>

      <p className="self-start line-clamp-3 text-[12px] font-light text-left select-all max-w-1/2">
        {artist?.detail.artist.briefDesc}
      </p>
      <div className="self-end">{children}</div>
    </div>
  );
};

export default memo(Info);
