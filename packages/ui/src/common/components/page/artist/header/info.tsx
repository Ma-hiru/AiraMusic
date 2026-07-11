import { cx } from "@emotion/css";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  useState,
  useEffect,
  useCallback,
  type ReactNode
} from "react";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIArtist } from "@/common/netease/api";
import { NeteaseArtist } from "@/common/netease/models";
import AppToast from "@/common/components/display/toast";

interface InfoProps {
  className?: string;
  children?: ReactNode;
  artist: Nullable<NeteaseArtist>;
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
    <div className={cx("flex flex-col items-start justify-start", className)}>
      <div
        className={cx(
          "relative inline-flex flex-col items-start text-3xl font-bold",
          alias && "pt-5"
        )}>
        {alias && (
          <h2
            className="absolute left-0 top-0 w-full truncate text-center text-[13px] font-medium opacity-75 select-all"
            title={alias}>
            {alias}
          </h2>
        )}
        <h1 className="whitespace-nowrap select-all">{artistName}</h1>
      </div>
      <div className="mt-auto inline-flex items-center gap-2 text-[13px] font-medium opacity-80 select-none">
        <span>粉丝: {RendererFormat.count(fansCount)}</span>
        <span className="opacity-55">/</span>
        <button
          className={cx(`
            cursor-pointer rounded-md px-2 py-1 font-semibold opacity-95
            hover:bg-primary hover:text-primary-text
            active:scale-98 select-none
            transition-all duration-300 ease-in-out
        `)}
          type="button"
          onClick={follow}>
          {followText}
        </button>
      </div>

      <p className="max-w-[70%] self-start line-clamp-3 text-left text-[13px] font-medium leading-tight opacity-75 select-all mt-0.5">
        {artist?.detail.artist.briefDesc}
      </p>
      <div className="self-end">{children}</div>
    </div>
  );
};

export default memo(Info);
