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

export function createAddToPlaylistModal({ track }: { track: NeteaseTrackRecord }): ModalRender {
  return {
    title: "收藏到歌单",
    subTitle: track.name,
    width: 500,
    content: <AddToPlaylistList track={track} />
  };
}

// eslint-disable-next-line react-refresh/only-export-components
const AddToPlaylistList: FC<{ track: NeteaseTrackRecord }> = ({ track }) => {
  const user = useUser();
  // 正在添加的歌单 id，避免重复点击
  const [adding, setAdding] = useState<Nullable<number>>(null);
  // 只列出自己创建的歌单
  const playlists = user?.userPlaylists ?? [];

  const addTo = async (pid: number) => {
    if (adding != null) return;
    setAdding(pid);
    try {
      const res = await NeteaseAPIPlaylist.modify({
        op: "add",
        pid,
        tracks: [track.id]
      });
      if (res.code === 200) {
        NeteaseServicesPlaylist.invalidate(pid);
        AppToast.show({
          type: "success",
          text: "已添加到歌单"
        });
        AppModal.close();
      } else {
        AppToast.show({
          type: "info",
          text: res.message || res.msg || "添加失败"
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
        const cover = NeteaseNetworkImage.fromPlaylistCover(p).setSize(NeteaseImageSize.xs);
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
