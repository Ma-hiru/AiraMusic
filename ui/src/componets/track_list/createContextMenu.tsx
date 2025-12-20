import { ContextMenuItem, ContextMenuRender } from "@mahiru/ui/componets/menu/MenuProvider";
import { ImageSize } from "@mahiru/ui/utils/filter";
import NeteaseImage from "@mahiru/ui/componets/public/NeteaseImage";
import { Player } from "@mahiru/ui/utils/player";

interface CreateContextMenuProps {
  clientX: number;
  clientY: number;
  track: NeteaseTrack;
  index: number;
  absoluteIndex: number;
  source?: number;
}

export function createContextMenu({
  clientX,
  clientY,
  track,
  index,
  absoluteIndex,
  source
}: CreateContextMenuProps) {
  return {
    items: createMenuItems(track, index, absoluteIndex, source),
    header: createHeader(track),
    clientX,
    clientY
  } satisfies ContextMenuRender;
}

function createHeader(track: NeteaseTrack) {
  return (
    <div className="flex items-center justify-between">
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
      <div className="overflow-hidden flex flex-col items-center justify-center px-2 max-w-56 select-none truncate">
        <p className="w-full font-semibold text-center text-[14px] truncate">{track.name}</p>
        <p className="w-full font-normal text-center text-[10px] opacity-50 truncate">
          {track.ar.map((ar) => ar.name).join(" / ")}
        </p>
      </div>
    </div>
  );
}

function createMenuItems(
  track: NeteaseTrack,
  index: number,
  absoluteIndex: number,
  source?: number
): ContextMenuItem[] {
  return [
    {
      label: "播放",
      onClick: () => {
        Player.addTrack(track, source, "next");
        Player.next(true);
      }
    },
    {
      label: "下一首播放",
      onClick: () => {
        Player.addTrack(track, source, "next");
      }
    },
    {
      label: "添加到播放列表",
      onClick: () => {
        Player.addTrack(track, source, "end");
      }
    },
    {
      label: "专辑"
    },
    {
      label: "评论"
    }
  ];
}
