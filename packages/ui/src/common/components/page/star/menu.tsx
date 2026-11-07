import { Trash2, ExternalLink } from "lucide-react";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseNetworkImage } from "@/common/netease/models";
import NeteaseImage from "@/common/components/display/image/netease-image";
import type { ContextMenuRender } from "@/common/components/display/menu/menu-provider";

interface CreateStarContextMenuProps {
  name: string;
  clientX: number;
  clientY: number;
  coverUrl?: string;
  kindLabel: string;
  onOpen: NormalFunc;
  onUnstar: NormalFunc;
}

/** 收藏项右键菜单 */
export function createStarContextMenu({
  onOpen,
  onUnstar,
  name,
  clientX,
  clientY,
  coverUrl,
  kindLabel
}: CreateStarContextMenuProps): ContextMenuRender {
  const image = NeteaseNetworkImage.fromURL(coverUrl)?.setSize(NeteaseImageSize.xs);

  return {
    clientX,
    clientY,
    header: (
      <div className="grid h-full w-full grid-rows-1 grid-cols-[auto_1fr] items-center">
        <NeteaseImage
          className="size-8 rounded-md select-none"
          image={image}
          shadowColor="light"
          cache
        />
        <div className="flex w-full min-w-0 flex-col items-start justify-center overflow-hidden px-2 select-none">
          <p className="w-full truncate text-left text-[12px] font-semibold">{name}</p>
          <p className="w-full truncate text-left text-[8px] font-normal opacity-50">{kindLabel}</p>
        </div>
      </div>
    ),
    items: [
      {
        prefix: <ExternalLink size={14} />,
        label: <p className="text-[12px]">打开</p>,
        onClick: onOpen
      },
      {
        prefix: <Trash2 size={14} />,
        label: <p className="text-[12px] text-red-500">取消收藏</p>,
        onClick: onUnstar
      }
    ]
  };
}
