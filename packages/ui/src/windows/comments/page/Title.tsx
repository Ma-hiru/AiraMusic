import { cx } from "@emotion/css";
import { FC, memo, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { NeteaseNetworkImage, NeteaseTrack } from "@mahiru/ui/public/source/netease/models";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { useCacheRequest } from "@mahiru/ui/public/utils/cache";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { Log } from "@mahiru/ui/public/utils/dev";
import dayjs from "dayjs";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";

interface TitleProps {
  commentBus: typeof ElectronServices.Bus.comment;
  className?: string;
}

const Title: FC<TitleProps> = ({ className, commentBus }) => {
  const [tags, setTags] = useState<string[]>([]);
  const { mainColor, textColorOnMain } = useThemeColor();
  const [track, setTrack] = useState<Nullable<NeteaseTrack>>(null);
  const cover = useMemo(
    () =>
      NeteaseNetworkImage.fromTrackCover(track)?.setSize(NeteaseImageSize.sm).setAlt(track?.name),
    [track]
  );

  const buildCacheKey = useRef((id: number) => id).current;
  const ugcSongRequestCache = useCacheRequest(NeteaseAPI.Wiki.ugcSong, buildCacheKey, "memory");
  useEffect(() => {
    if (!track) return;

    let cancel = false;
    ugcSongRequestCache(track.id).then((res) => {
      if (cancel) return;
      const tags: string[] = [];
      if (res.data.language && res.data.language !== "未知") tags.push(res.data.language);
      if (Array.isArray(res.data.mvIds) && res.data.mvIds.length > 0) tags.push("MV");
      if (res.data.publishTime) tags.push(dayjs(res.data.publishTime).format("YYYY-MM-DD"));
      startTransition(() => setTags(tags));
    });

    return () => {
      cancel = true;
    };
  }, [track, ugcSongRequestCache]);

  useEffect(() => {
    if (!commentBus.data?.id) return;
    NeteaseServices.Track.idEnsure(commentBus.data?.id)
      .then(setTrack)
      .catch((err) => {
        Log.error(err);
        setTrack(null);
      });
  }, [commentBus.data?.id]);
  return (
    <div
      className={cx(
        "w-full flex flex-row items-center justify-center gap-2 px-8 overflow-hidden",
        className
      )}>
      <NeteaseImage
        className="size-10 rounded-full shrink-0"
        cache
        image={cover}
        cacheLazy={false}
      />
      <div className="flex flex-col items-start justify-center gap-0.5 overflow-hidden">
        <h1 className="font-semibold text-sm truncate">{track?.name}</h1>
        <h2 className="font-medium text-xs">{track?.artist().join(" / ")}</h2>
        <div className="flex flex-row items-center justify-start gap-1 flex-wrap">
          {tags.map((tag) => {
            return (
              <span
                style={{
                  backgroundColor: mainColor.string(),
                  color: textColorOnMain.string()
                }}
                className="inline-block rounded-full px-1.5 py-0.5 text-[10px]"
                key={tag}>
                {tag}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default memo(Title);
