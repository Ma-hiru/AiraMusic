import { type FC, useState } from "react";
import { cx } from "@emotion/css";
import { NeteaseNetworkImage, type NeteaseTrackRecord } from "@/common/netease/models";
import { NeteaseAPIPlaylist } from "@/common/netease/api";
import { NeteaseServicesPlaylist } from "@/common/netease/services";
import { NeteaseImageSize } from "@/common/enum";
import { useUser } from "@/common/store/user";
import { Log } from "@/common/lib/log";
import NeteaseImage from "@/common/components/display/image/netease-image";
import AppToast from "@/common/components/display/toast";
import AppModal from "./use";
import type { ModalRender } from "./modal-provider";

export function createAddToPlaylistModal({
  tracks,
  onCreated,
  excludeId
}: {
  tracks: NeteaseTrackRecord[];
  onCreated: Optional<NormalFunc<[pid: number]>>;
  /** 排除的歌单 id（通常是当前所在歌单，避免把歌曲加回自己） */
  excludeId?: number;
}): ModalRender {
  return {
    title: "收藏到歌单",
    subTitle: tracks.length === 1 ? tracks[0]?.name : `共 ${tracks.length} 首`,
    width: 500,
    content: <AddToPlaylistList tracks={tracks} onCreated={onCreated} excludeId={excludeId} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const AddToPlaylistList: FC<{
  tracks: NeteaseTrackRecord[];
  onCreated: Optional<NormalFunc<[pid: number]>>;
  excludeId?: number;
}> = ({ tracks, onCreated, excludeId }) => {
  const user = useUser();
  // 正在添加的歌单 id，避免重复点击
  const [adding, setAdding] = useState<Nullable<number>>(null);
  // 只列出自己创建的歌单，排除当前所在歌单
  const playlists = (user?.userPlaylists ?? []).filter((p) => p.id !== excludeId);

  const addTo = async (pid: number) => {
    if (adding != null || tracks.length === 0) return;
    setAdding(pid);
    try {
      const res = await NeteaseAPIPlaylist.modify({
        op: "add",
        pid,
        tracks: tracks.map((t) => t.id)
      });
      if (res.status === 200) {
        NeteaseServicesPlaylist.invalidate(pid);
        onCreated?.(pid);
        AppToast.show({
          type: "success",
          text: tracks.length === 1 ? "已添加到歌单" : `已添加 ${tracks.length} 首`
        });
        AppModal.close();
      } else {
        AppToast.show({
          type: "info",
          text: "添加失败"
        });
      }
    } catch (err) {
      Log.error(err);
      AppToast.show({
        type: "error",
        text: "添加失败，请重试"
      });
    } finally {
      setAdding(null);
    }
  };

  if (playlists.length === 0) {
    return <p className="py-8 text-center text-[13px] opacity-50">还没有自己创建的歌单</p>;
  }

  return (
    <div className="flex flex-col gap-1">
      {playlists.map((p) => {
        const cover = NeteaseNetworkImage.fromPlaylistCover(p)
          .setSize(NeteaseImageSize.xs)
          .setCacheKey(
            `${p.updateTime}-${p.trackCount}-${p.trackUpdateTime}-${p.trackNumberUpdateTime}`
          );

        return (
          <button
            key={p.id}
            type="button"
            disabled={adding != null}
            onClick={() => addTo(p.id)}
            className={cx(
              "flex w-full items-center gap-3 rounded-md p-2 text-left transition-all",
              "hover:bg-white/10 active:scale-98 disabled:opacity-50"
            )}>
            <NeteaseImage
              cache
              image={cover}
              className="size-10 shrink-0 rounded-md"
              shadowColor="light"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-bold">{p.name}</p>
              <p className="truncate text-[11px] opacity-50">{p.trackCount} 首</p>
            </div>
          </button>
        );
      })}
    </div>
  );
};
