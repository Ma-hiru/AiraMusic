import {
  CalendarDays,
  Headphones,
  ListMusic,
  Maximize2,
  MessageSquare,
  Share2,
  UserRound
} from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage, type NeteasePlaylist } from "@/common/netease/models";
import { RendererFormat } from "@/common/lib/format";
import { RendererWindow } from "@/common/lib/window";
import type { ModalRender } from "./modal-provider";

import NeteaseImage from "@/common/components/image/netease-image";

export function createPlaylistCoverModal(props: PlaylistCoverModalProps): ModalRender {
  return {
    title: "歌单详情",
    subTitle: "Playlist",
    width: 900,
    content: createPlaylistCoverContent(props)
  };
}

interface PlaylistCoverModalProps {
  playlist: NeteasePlaylist;
  coverCacheKey?: string;
}

function createPlaylistCoverContent({ playlist, coverCacheKey }: PlaylistCoverModalProps) {
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
  return (
    <div className="grid gap-7 md:grid-cols-[18rem_minmax(0,1fr)]">
      {/** 封面 */}
      <section className="space-y-4">
        <button
          type="button"
          title="查看封面"
          onClick={openCover}
          className="
            group relative aspect-square w-full max-w-72 overflow-hidden rounded-lg
            bg-white/10   outline-none
            transition-all duration-300 ease-in-out

          ">
          <NeteaseImage
            cache
            cacheLazy={false}
            image={cover}
            shadow="none"
            className="size-full"
            imageClassName="transition-transform duration-300 ease-in-out group-hover:scale-105"
          />
          <span
            className="
              absolute right-2 top-2 flex size-8 items-center justify-center rounded-md
              border border-white/20 bg-black/30 text-white opacity-0 backdrop-blur-md
              transition-all duration-300 ease-in-out group-hover:opacity-100
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
      <section className="flex min-w-0 flex-col gap-6 py-1">
        <div className="min-w-0 space-y-2">
          <h3 className="line-clamp-2 text-[32px] font-black leading-tight tracking-normal">
            {playlist.name}
          </h3>
          <section className="h-10 flex justify-between items-center">
            <div className="flex flex-wrap gap-2">
              {playlist.tags.map((tag) => (
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
            <div className="flex min-w-0 items-center gap-2">
              <NeteaseImage
                cache
                cacheLazy={false}
                image={avatar}
                className="size-5 shrink-0 rounded-full"
                shadowColor="light"
              />
              <p className="truncate text-[12px] font-black tracking-normal">
                {playlist.creator.nickname}
              </p>
            </div>
          </section>
        </div>
        <p
          className={`
            max-h-56 overflow-y-auto whitespace-pre-wrap text-[13px]
            font-semibold leading-6 opacity-80 scrollbar
          `}>
          {playlist.description || "暂无简介"}
        </p>
      </section>
    </div>
  );
}

function createPlaylistStats(playlist: NeteasePlaylist) {
  return [
    {
      icon: ListMusic,
      label: "歌曲",
      value: `${playlist.trackCount || 0} 首`
    },
    {
      icon: Headphones,
      label: "播放",
      value: playlist.playCountFormat()
    },
    {
      icon: CalendarDays,
      label: "创建",
      value: RendererFormat.time(playlist.createTime) || "-"
    },
    {
      icon: MessageSquare,
      label: "评论",
      value: RendererFormat.count(playlist.commentCount) || "0"
    },
    {
      icon: Share2,
      label: "分享",
      value: RendererFormat.count(playlist.shareCount) || "0"
    },
    {
      icon: UserRound,
      label: "收藏",
      value: RendererFormat.count(playlist.subscribedCount) || "0"
    }
  ];
}
