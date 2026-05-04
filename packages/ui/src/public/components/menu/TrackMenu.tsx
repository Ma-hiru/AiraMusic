import {
  NeteaseNetworkImage,
  NeteaseTrackRecord,
  NeteaseUser
} from "@mahiru/ui/public/source/netease/models";
import { Copy, DiscAlbum, ListMusic, ListPlus, MessageSquare, Play } from "lucide-react";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/public/components/menu/MenuProvider";
import { userStoreSnapshot } from "@mahiru/ui/public/store/user";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import AppToast from "@mahiru/ui/public/components/toast";

export type TrackContextMenuAction = "comment" | "album" | "play" | "nextPlay" | "addPlayList";

export type TrackContextMenuOnClick = NormalFunc<
  [type: TrackContextMenuAction, track: NeteaseTrackRecord]
>;

export function createTrackContextMenu(props: {
  clientX: number;
  clientY: number;
  track: NeteaseTrackRecord;
  onClick?: TrackContextMenuOnClick;
}): ContextMenuRender {
  const { clientX, clientY, track, onClick } = props;
  return {
    header: createHeader(track),
    items: createMenuItems(track, onClick),
    clientX,
    clientY
  };
}

function createHeader(track: NeteaseTrackRecord) {
  const image = NeteaseNetworkImage.fromTrackCover(track).setSize(NeteaseImageSize.xs);
  return (
    <div className="w-full h-full grid items-center grid-rows-1 grid-cols-[auto_1fr]">
      <NeteaseImage
        cache
        className={`
            size-8 rounded-md select-none
            ease-in-out duration-300 transition-all
          `}
        image={image}
        shadowColor="light"
      />
      <div className="w-full overflow-hidden flex flex-col items-start justify-center px-2 select-none truncate">
        <p className="w-full font-semibold text-left text-[12px] truncate">{track.name}</p>
        <p className="w-full font-normal text-left text-[8px] opacity-50 truncate">
          {track.detail.artist.join(" / ")}
        </p>
      </div>
    </div>
  );
}

function createMenuItems(
  track: NeteaseTrackRecord,
  onClick?: TrackContextMenuOnClick
): ContextMenuItem[] {
  const { _user } = userStoreSnapshot();
  const playable = track.detail.playable(NeteaseUser.fromObject(_user));
  const items: ContextMenuItem[] = [];

  items.push(
    {
      prefix: <DiscAlbum size={14} />,
      label: <p className="text-[12px]">专辑</p>,
      onClick: () => onClick?.("album", track)
    },
    {
      prefix: <MessageSquare size={14} />,
      label: <p className="text-[12px]">评论</p>,
      onClick: () => onClick?.("comment", track)
    }
  );

  if (playable) {
    items.push(
      {
        prefix: <Play size={14} />,
        label: <p className="text-[12px]">播放</p>,
        onClick: () => onClick?.("play", track)
      },
      {
        prefix: <ListPlus size={14} />,
        label: <p className="text-[12px]">下一首播放</p>,
        onClick: () => onClick?.("nextPlay", track)
      },
      {
        prefix: <ListMusic size={14} />,
        label: <p className="text-[12px]">添加到播放列表</p>,
        onClick: () => onClick?.("addPlayList", track)
      }
    );
  }

  items.push(
    {
      prefix: <Copy size={14} />,
      label: <p className="text-[12px]">复制歌曲名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(track.name).then(() => {
          AppToast.show({
            type: "success",
            text: "复制成功"
          });
        });
      }
    },
    {
      prefix: <div className="size-3.5" />,
      label: <p className="text-[12px]">复制专辑名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(track.detail.al.name).then(() => {
          AppToast.show({
            type: "success",
            text: "复制成功"
          });
        });
      }
    },
    {
      prefix: <div className="size-3.5" />,
      label: <p className="text-[12px]">复制歌手名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(track.detail.artist?.join(" ")).then(() => {
          AppToast.show({
            type: "success",
            text: "复制成功"
          });
        });
      }
    }
  );
  return items;
}
