import { cx } from "@emotion/css";
import { type FC, memo, startTransition, useEffect, useMemo, useRef, useState } from "react";
import {
  NeteaseAlbum,
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteaseTrack
} from "@/common/netease/models";
import { useCacheRequest } from "@/common/utils/cache";
import { Log } from "@/common/lib/log";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { NeteaseAPIWiki } from "@/common/netease/api";
import {
  NeteaseServicesAlbum,
  NeteaseServicesPlaylist,
  NeteaseServicesTrack
} from "@/common/netease/services";
import { RendererEventBus } from "@/common/lib/bus";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TitleProps {
  commentBus: typeof RendererEventBus.comment;
  className?: string;
}

const Title: FC<TitleProps> = ({ className, commentBus }) => {
  const [tags, setTags] = useState<string[]>([]);
  const [track, setTrack] = useState<Nullable<NeteaseTrack>>(null);
  const [playlist, setPlaylist] = useState<Nullable<NeteasePlaylist>>(null);
  const [album, setAlbum] = useState<Nullable<NeteaseAlbum>>(null);
  const cover = useMemo(() => {
    if (commentBus.data?.type === "track") {
      return NeteaseNetworkImage.fromTrackCover(track)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(track?.name);
    } else if (commentBus.data?.type === "playlist") {
      return NeteaseNetworkImage.fromPlaylistCover(playlist)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(playlist?.name);
    } else if (commentBus.data?.type === "album") {
      return NeteaseNetworkImage.fromAlbumCover(album)
        ?.setSize(NeteaseImageSize.sm)
        .setAlt(album?.content.name);
    }
  }, [album, commentBus.data?.type, playlist, track]);

  const buildCacheKey = useRef((id: number) => id).current;
  const ugcSongRequestCache = useCacheRequest(NeteaseAPIWiki.ugcSong, buildCacheKey, "memory");
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
      if (res.data.publishTime) tags.push(RendererFormat.time(res.data.publishTime));
      startTransition(() => setTags(tags));
    });

    return () => {
      cancel = true;
    };
  }, [commentBus.data?.type, track, ugcSongRequestCache]);

  useEffect(() => {
    if (!commentBus.data?.id) return;
    if (commentBus.data.type === "track") {
      NeteaseServicesTrack.idEnsure(commentBus.data?.id)
        .then(setTrack)
        .catch((err) => {
          Log.error(err);
          setTrack(null);
        });
    } else if (commentBus.data.type === "playlist") {
      NeteaseServicesPlaylist.id(commentBus.data?.id)
        .then(setPlaylist)
        .catch((err) => {
          Log.error(err);
          setPlaylist(null);
        });
    } else if (commentBus.data.type === "album") {
      NeteaseServicesAlbum.id(commentBus.data?.id)
        .then(setAlbum)
        .catch((err) => {
          Log.error(err);
          setAlbum(null);
        });
    }
  }, [commentBus.data?.id, commentBus.data?.type]);

  useEffect(() => {
    let name = `${import.meta.env.APP_NAME} 评论`;
    if (commentBus.data?.type === "track" && track) {
      name += ` - ${track.name}`;
    } else if (commentBus.data?.type === "playlist" && playlist) {
      name += ` - ${playlist.name}`;
    } else if (commentBus.data?.type === "album" && album) {
      name += ` - ${album.content.name}`;
    }
    document.title = name;
  }, [album, commentBus.data?.type, playlist, track]);
  return (
    <div
      className={cx(
        "w-full flex flex-row items-center justify-center gap-2 px-8 overflow-hidden",
        className
      )}>
      <NeteaseImage
        cache
        shadow="float"
        className="size-10 rounded-full shrink-0 border"
        image={cover}
        cacheLazy={false}
      />
      <div className="flex flex-col items-start justify-center gap-0.5 overflow-hidden">
        {commentBus.data?.type === "track" && (
          <>
            <h1 className="font-semibold text-sm line-clamp-1">{track?.name}</h1>
            <h2 className="font-medium text-xs opacity-60">{track?.artist.join(" / ")}</h2>
            <div className="flex flex-row items-center justify-start gap-1 flex-wrap">
              {tags.map((tag) => {
                return (
                  <span
                    className="inline-block rounded-full px-1.5 py-0.5 text-[10px] bg-(--theme-color-main) text-(--text-color-on-main)"
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
            <h1 className="font-semibold text-sm line-clamp-2">{playlist?.name}</h1>
            <h2 className="font-medium text-xs opacity-60">{playlist?.creator?.nickname}</h2>
          </>
        )}
        {commentBus.data?.type === "album" && (
          <>
            <h1 className="font-semibold text-sm line-clamp-2">{album?.content.name}</h1>
            <h2 className="font-medium text-xs opacity-60">{album?.content.artist.name}</h2>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(Title);
