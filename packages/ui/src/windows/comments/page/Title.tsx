import { cx } from "@emotion/css";
import { FC, memo, startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteaseTrack
} from "@mahiru/ui/public/source/netease/models";
import { useCacheRequest } from "@mahiru/ui/public/utils/cache";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { Log } from "@mahiru/ui/public/utils/dev";
import dayjs from "dayjs";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import ElectronServices from "@mahiru/ui/public/source/electron/services";
import NeteaseAPI from "@mahiru/ui/public/source/netease/api";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";

interface TitleProps {
  commentBus: typeof ElectronServices.Bus.comment;
  className?: string;
}

const Title: FC<TitleProps> = ({ className, commentBus }) => {
  const [tags, setTags] = useState<string[]>([]);
  const { mainColor, textColorOnMain } = useThemeColor();
  const [track, setTrack] = useState<Nullable<NeteaseTrack>>(null);
  const [playlist, setPlaylist] = useState<Nullable<NeteasePlaylist>>(null);
  const cover = useMemo(() => {
    if (commentBus.data?.type === "track") {
      return NeteaseNetworkImage.fromTrackCover(track)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(track?.name);
    } else if (commentBus.data?.type === "playlist") {
      return NeteaseNetworkImage.fromPlaylistCover(playlist)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(playlist?.name);
    }
  }, [commentBus.data?.type, playlist, track]);

  const buildCacheKey = useRef((id: number) => id).current;
  const ugcSongRequestCache = useCacheRequest(NeteaseAPI.Wiki.ugcSong, buildCacheKey, "memory");
  useEffect(() => {
    if (!track || commentBus.data?.type !== "track") {
      setTags([]);
      return;
    }

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
  }, [commentBus.data?.type, track, ugcSongRequestCache]);

  useEffect(() => {
    if (!commentBus.data?.id) return;
    if (commentBus.data.type === "track") {
      NeteaseServices.Track.idEnsure(commentBus.data?.id)
        .then(setTrack)
        .catch((err) => {
          Log.error(err);
          setTrack(null);
        });
    } else if (commentBus.data.type === "playlist") {
      NeteaseServices.Playlist.id(commentBus.data?.id)
        .then(setPlaylist)
        .catch((err) => {
          Log.error(err);
          setPlaylist(null);
        });
    }
  }, [commentBus.data?.id, commentBus.data?.type]);
  return (
    <div
      className={cx(
        "w-full flex flex-row items-center justify-center gap-2 px-8 overflow-hidden text-(--theme-color-main)",
        className
      )}>
      <NeteaseImage
        className="size-10 rounded-full shrink-0"
        cache
        image={cover}
        cacheLazy={false}
      />
      <div className="flex flex-col items-start justify-center gap-0.5 overflow-hidden">
        {commentBus.data?.type === "track" && (
          <>
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
          </>
        )}
        {commentBus.data?.type === "playlist" && (
          <>
            <h1 className="font-semibold text-sm truncate">{playlist?.name}</h1>
            <h2 className="font-medium text-xs">{playlist?.creator?.nickname}</h2>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(Title);
