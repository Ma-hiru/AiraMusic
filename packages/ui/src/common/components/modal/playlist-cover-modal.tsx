import { type LucideIcon, Maximize2 } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseAlbum, NeteaseNetworkImage, type NeteasePlaylist } from "@/common/netease/models";
import { RendererWindow } from "@/common/lib/window";
import { createAlbumStats, createPlaylistStats } from "@/common/utils/playlist";
import type { ModalRender } from "./modal-provider";
import { type FC } from "react";

import NeteaseImage from "@/common/components/image/netease-image";

export function createPlaylistCoverModal({
  playlist,
  coverCacheKey
}: {
  playlist: NeteasePlaylist;
  coverCacheKey?: string;
}): ModalRender {
  const cover = NeteaseNetworkImage.fromPlaylistCover(playlist)
    .setSize(NeteaseImageSize.lg)
    .setCacheKey((coverCacheKey ?? "") + playlist.updateTime);
  const avatar = NeteaseNetworkImage.fromUserAvatar(playlist.creator)?.setSize(NeteaseImageSize.sm);
  const stats = createPlaylistStats(playlist);
  const openCover = async () => {
    const image = cover.toNetworkImage().setSize(NeteaseImageSize.raw);
    await RendererWindow.image.openAwait();
    RendererWindow.image.send("imageCheckerBus", {
      url: image.src,
      alt: image.alt ?? playlist.name
    });
  };
  return {
    title: "歌单详情",
    subTitle: "Playlist",
    width: 900,
    content: (
      <CoverModal
        name={playlist.name}
        desc={playlist.description}
        tags={playlist.tags}
        persons={[{ avatar, nickname: playlist.creator.nickname }]}
        cover={cover}
        onCoverOpen={openCover}
        stats={stats}
      />
    )
  };
}

export function createAlbumCoverModal({
  album,
  dynamic,
  coverCacheKey
}: {
  album: NeteaseAlbum;
  dynamic: NeteaseAPI.NeteaseAlbumDynamicDetailResponse;
  coverCacheKey?: string;
}) {
  const cover = NeteaseNetworkImage.fromAlbumCover(album)
    .setSize(NeteaseImageSize.lg)
    .setCacheKey((coverCacheKey ?? "") + album.content.publishTime);

  const stats = createAlbumStats(album, dynamic);
  const openCover = async () => {
    const image = cover.toNetworkImage().setSize(NeteaseImageSize.raw);
    await RendererWindow.image.openAwait();
    RendererWindow.image.send("imageCheckerBus", {
      url: image.src,
      alt: image.alt ?? album.content.name
    });
  };

  const artist = (album.content.artists ?? [])
    .filter((a) => a.name !== album.content.artist.name)
    .concat([album.content.artist])
    .filter(Boolean)
    .map(({ picUrl, name }) => {
      return {
        avatar: NeteaseNetworkImage.fromURL(picUrl)?.setSize(NeteaseImageSize.sm),
        nickname: name
      };
    });

  return {
    title: "专辑详情",
    subTitle: "Album",
    width: 900,
    content: (
      <CoverModal
        name={album.content.name}
        desc={album.content.description}
        tags={album.content.tags ? [album.content.tags] : []}
        persons={artist}
        cover={cover}
        onCoverOpen={openCover}
        stats={stats}
      />
    )
  };
}

interface CoverModalProps {
  name: string;
  desc: string;
  tags: string[];
  persons: { avatar?: NeteaseNetworkImage; nickname: string }[];
  cover: NeteaseNetworkImage;
  onCoverOpen: NormalFunc;
  stats: { icon: LucideIcon; label: string; value: string | number }[];
}

// eslint-disable-next-line react-refresh/only-export-components
const CoverModal: FC<CoverModalProps> = ({
  name,
  desc,
  tags,
  persons,
  cover,
  onCoverOpen,
  stats
}) => {
  return (
    <div className="w-full h-full overflow-y-auto scrollbar scrollbar-show grid gap-7 md:grid-cols-[18rem_minmax(0,1fr)]">
      {/** 封面 */}
      <section className="space-y-4">
        <button
          type="button"
          title="查看封面"
          onClick={onCoverOpen}
          className="
            group relative aspect-square w-full overflow-hidden rounded-lg
            bg-white/10  outline-none mx-auto
            transition-all duration-300 ease-in-out
          ">
          <NeteaseImage
            cache
            cacheLazy={false}
            image={cover}
            shadow="none"
            className="size-full"
            imageClassName="transition-transform duration-300 ease-in-out group-hover:scale-105 cursor-pointer"
          />
          <span
            className="
              absolute right-2 top-2 flex size-8 items-center justify-center rounded-md
              border border-white/20 bg-black/30 text-white opacity-0 backdrop-blur-md
              transition-all duration-300 ease-in-out group-hover:opacity-100 cursor-pointer
            ">
            <Maximize2 className="size-4" />
          </span>
        </button>
        <div
          className="
            rounded-lg border border-white/10 bg-white/10 px-3 py-3
            shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]
          ">
          <div className="grid grid-cols-3 gap-3 text-[11px] font-semibold">
            {stats.map(({ icon: Icon, label, value }) => (
              <div key={label} className="min-w-0">
                <div className="flex items-center gap-1.5 opacity-55">
                  <Icon className="size-3.5 shrink-0" />
                  <span>{label}</span>
                </div>
                <p className="mt-0.5 truncate text-[12px] font-black opacity-85">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      {/** 简介*/}
      <section className="flex min-w-0 flex-col justify-between gap-3">
        <section className="flex flex-col gap-6">
          <h3 className="line-clamp-2 text-[32px] font-black leading-tight tracking-normal">
            {name}
          </h3>
          <p
            className={`
            max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px]
            font-semibold leading-6 opacity-80 scrollbar
          `}>
            {desc || "暂无简介"}
          </p>
        </section>
        <section className="flex justify-between items-center">
          <div className="flex flex-wrap gap-2 shrink-0">
            {tags.map((tag) => (
              <span
                key={tag}
                className="
                  rounded-md bg-(--theme-color-main) px-2 py-1 text-[10px] font-black
                  text-(--text-color-on-main)
                ">
                {tag}
              </span>
            ))}
          </div>
          <section className="flex flex-row-reverse gap-1 shrink-0 truncate">
            {persons.map(({ avatar, nickname }, index) => {
              const divider = index !== persons.length - 1;
              return (
                <>
                  <div key={nickname} className="flex min-w-0 items-center gap-1">
                    {avatar && (
                      <NeteaseImage
                        cache
                        cacheLazy={false}
                        image={avatar}
                        className="size-5 shrink-0 rounded-full"
                        shadowColor="light"
                      />
                    )}
                    <p className="truncate text-[12px] font-black tracking-normal">{nickname}</p>
                  </div>
                  {divider && <span className="font-medium opacity-50">/</span>}
                </>
              );
            })}
          </section>
        </section>
      </section>
    </div>
  );
};
