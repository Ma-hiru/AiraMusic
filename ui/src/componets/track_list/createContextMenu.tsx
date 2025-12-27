import { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/componets/menu/MenuProvider";
import { ImageSize } from "@mahiru/ui/utils/filter";
import { Player } from "@mahiru/ui/utils/player";
import { Copy, DiscAlbum, ListMusic, ListPlus, MessageSquare, Play } from "lucide-react";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { CommentType } from "@mahiru/ui/api/comment";

interface CreateContextMenuProps {
  clientX: number;
  clientY: number;
  track: NeteaseTrack;
  source?: number;
  openInfoWindow: <T extends keyof InfoSyncValueMap>(type: T, value: InfoSyncValueMap[T]) => void;
}

export function createContextMenu({
  clientX,
  clientY,
  track,
  source,
  openInfoWindow
}: CreateContextMenuProps) {
  return {
    header: createHeader(track),
    items: createMenuItems({
      track,
      openInfoWindow,
      source
    }),
    clientX,
    clientY
  } satisfies ContextMenuRender;
}

function createHeader(track: NeteaseTrack) {
  return (
    <div className="w-full h-full grid items-center grid-rows-1 grid-cols-[auto_1fr]">
      <NeteaseImage
        className={`
            size-8 rounded-md select-none
            ease-in-out duration-300 transition-all
          `}
        src={track.al.cachedPicUrl || track.al.picUrl}
        retryURL={track.al.picUrl}
        alt={track.al.name}
        size={ImageSize.xs}
        shadowColor="light"
      />
      <div className="w-full overflow-hidden flex flex-col items-start justify-center px-2 select-none truncate">
        <p className="w-full font-semibold text-left text-[12px] truncate">{track.name}</p>
        <p className="w-full font-normal text-left text-[8px] opacity-50 truncate">
          {track.ar.map((ar) => ar.name).join(" / ")}
        </p>
      </div>
    </div>
  );
}

function createMenuItems(props: {
  track: NeteaseTrack;
  openInfoWindow: <T extends keyof InfoSyncValueMap>(type: T, value: InfoSyncValueMap[T]) => void;
  source?: number;
}): ContextMenuItem[] {
  return [
    {
      prefix: <Copy size={14} />,
      label: <p className="text-[12px]">复制歌曲名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(props.track.name).then(() => {
          //todo
        });
      }
    },
    {
      prefix: <div className="size-3.5" />,
      label: <p className="text-[12px]">复制专辑名</p>,
      onClick: () => {
        window.navigator.clipboard.writeText(props.track.al.name).then(() => {
          //todo
        });
      }
    },
    {
      prefix: <div className="size-3.5" />,
      label: <p className="text-[12px]">复制歌手名</p>,
      onClick: () => {
        window.navigator.clipboard
          .writeText(props.track.ar.map((a) => a.name).join(" "))
          .then(() => {
            //todo
          });
      }
    },
    {
      prefix: <Play size={14} />,
      label: <p className="text-[12px]">播放</p>,
      onClick: () => {
        Player.addTrack(props.track, props.source, "next");
        Player.next(true);
      }
    },
    {
      prefix: <ListPlus size={14} />,
      label: <p className="text-[12px]">下一首播放</p>,
      onClick: () => {
        Player.addTrack(props.track, props.source, "next");
      }
    },
    {
      prefix: <ListMusic size={14} />,
      label: <p className="text-[12px]">添加到播放列表</p>,
      onClick: () => {
        Player.addTrack(props.track, props.source, "end");
      }
    },
    {
      prefix: <DiscAlbum size={14} />,
      label: <p className="text-[12px]">专辑</p>
    },
    {
      prefix: <MessageSquare size={14} />,
      label: <p className="text-[12px]">评论</p>,
      onClick: () => {
        props.openInfoWindow("comments", {
          type: CommentType.Song,
          id: props.track.id,
          track: props.track
        });
      }
    }
  ];
}
