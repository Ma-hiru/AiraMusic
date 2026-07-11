import { cx } from "@emotion/css";
import { memo, useRef, type FC, useMemo, useState, useEffect, startTransition } from "react";
import { Log } from "@/common/lib/log";
import { NeteaseImageSize } from "@/common/enum";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import { NeteaseAPIWiki } from "@/common/netease/api";
import { useCacheRequest } from "@/common/utils/cache";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import {
  NeteaseAlbum,
  NeteaseTrack,
  NeteasePlaylist,
  NeteaseNetworkImage
} from "@/common/netease/models";
import {
  NeteaseServicesAlbum,
  NeteaseServicesTrack,
  NeteaseServicesPlaylist
} from "@/common/netease/services";
import Marquee from "@/common/components/display/marquee";
import NeteaseImage from "@/common/components/display/image/netease-image";

interface TitleProps {
  className?: string;
  commentBus: typeof RendererIPCMessageBus.comment;
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
    let name = "评论";
    if (commentBus.data?.type === "track" && track) {
      name += ` - ${track.name}`;
    } else if (commentBus.data?.type === "playlist" && playlist) {
      name += ` - ${playlist.name}`;
    } else if (commentBus.data?.type === "album" && album) {
      name += ` - ${album.content.name}`;
    }
    window.document.title = name;
    RendererWindow.current.title(name);
  }, [album, commentBus.data?.type, playlist, track]);

  const marqueeOpts = {
    speed: 10,
    pingPong: true,
    pauseOnHover: true,
    gapDuration: 2000
  };
  return (
    <div
      className={cx(
        "w-full flex flex-col items-center justify-start gap-1 px-8 pb-2 overflow-hidden",
        className
      )}>
      <NeteaseImage
        className="size-10 rounded-full shrink-0 border"
        image={cover}
        shadow="float"
        cacheLazy={false}
        cache
      />
      {commentBus.data?.type === "track" && (
        <>
          <Marquee
            className="font-semibold text-sm text-center"
            text={track?.name}
            options={marqueeOpts}
          />
          <Marquee
            className="font-medium text-xs opacity-60 text-center"
            options={marqueeOpts}
            text={track?.artist.join(" / ")}
          />
          <div className="flex flex-row items-center justify-start gap-1 flex-wrap text-center">
            {tags.map((tag) => {
              return (
                <span
                  key={tag}
                  className="inline-block rounded-full px-1.5 py-0.5 text-[10px] bg-primary text-(--text-color-on-main)">
                  {tag}
                </span>
              );
            })}
          </div>
        </>
      )}
      {commentBus.data?.type === "playlist" && (
        <>
          <Marquee
            className="font-semibold text-sm text-center"
            options={marqueeOpts}
            text={playlist?.name}
          />
          <Marquee
            className="font-medium text-xs opacity-60 text-center"
            text={playlist?.creator?.nickname}
          />
        </>
      )}
      {commentBus.data?.type === "album" && (
        <>
          <Marquee
            className="font-semibold text-sm text-center"
            options={marqueeOpts}
            text={album?.content.name}
          />
          <Marquee
            className="font-medium text-xs opacity-60 text-center"
            options={marqueeOpts}
            text={album?.content.artist.name}
          />
        </>
      )}
    </div>
  );
};

export default memo(Title);
