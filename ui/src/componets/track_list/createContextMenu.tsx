import { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/componets/menu/MenuProvider";
import { ImageSize } from "@mahiru/ui/utils/filter";
import { Player } from "@mahiru/ui/utils/player";
import { DiscAlbum, ListMusic, ListPlus, MessageSquare, Play } from "lucide-react";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { CommentType } from "@mahiru/ui/api/comment";

interface CreateContextMenuProps {
  clientX: number;
  clientY: number;
  track: NeteaseTrack;
  index: number;
  absoluteIndex: number;
  source?: number;
  openInfoWindow: <T extends keyof InfoSyncValueMap>(type: T, value: InfoSyncValueMap[T]) => void;
}

export function createContextMenu({
  clientX,
  clientY,
  track,
  index,
  absoluteIndex,
  source,
  openInfoWindow
}: CreateContextMenuProps) {
  return {
    header: createHeader(track),
    items: createMenuItems({
      track,
      index,
      absoluteIndex,
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
  index: number;
  absoluteIndex: number;
  openInfoWindow: <T extends keyof InfoSyncValueMap>(type: T, value: InfoSyncValueMap[T]) => void;
  source?: number;
}): ContextMenuItem[] {
  return [
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
