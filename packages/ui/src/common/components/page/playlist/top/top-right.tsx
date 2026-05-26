import { type FC, memo, useMemo } from "react";
import { SquareArrowRightEnter, SquareArrowRightExit, SquarePen } from "lucide-react";
import { NeteaseNetworkImage, NeteasePlaylist } from "@/common/source/netease/models";
import { useUser } from "@/common/store/user";
import { RendererFormat } from "@/common/lib/format";
import { PlaylistSource } from "@/common/enum";
import RendererImageConstants from "@/common/constants/image";

import Search from "@/common/components/public/search";
import NeteaseImage from "@/common/components/image/netease-image";

interface TopRightProps {
  summary: Nullable<NeteasePlaylist>;
  type: PlaylistSource;
  searchTracks: NormalFunc<[k: string]>;
  setTying: NormalFunc<[typing: boolean]>;
  pageActionType?: "enter" | "out" | "none";
  onPageAction?: NormalFunc;
}

const TopRight: FC<TopRightProps> = ({
  summary,
  searchTracks,
  type,
  setTying,
  pageActionType,
  onPageAction
}) => {
  const user = useUser();

  const avatar = useMemo(() => {
    return NeteaseNetworkImage.fromUserAvatar(summary?.creator)?.setSize(
      RendererImageConstants.PlaylistPageCreatorAvatarSize
    );
  }, [summary]);

  const action = useMemo(() => {
    if (pageActionType === "enter")
      return (
        <SquareArrowRightEnter
          className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90 ease-in-out transition-all duration-300"
          onClick={onPageAction}
        />
      );
    if (pageActionType === "out")
      return (
        <SquareArrowRightExit
          className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90 ease-in-out transition-all duration-300"
          onClick={onPageAction}
        />
      );
    return null;
  }, [onPageAction, pageActionType]);

  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px] text-(--text-color-on-main)/80">
      <div className="flex items-center gap-2">
        {/*EditBtn*/}
        <div className="size-5">
          {summary?.creator?.userId === user?.profile.userId && type !== "like" && (
            <SquarePen className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90 ease-in-out transition-all duration-300" />
          )}
        </div>
        {action}
      </div>
      {/*Info*/}
      <div className="flex flex-col items-end justify-end">
        <Search searchTracks={searchTracks} setIsTyping={setTying} />
        <div className="flex items-center gap-2 mt-2 font-semibold">
          <NeteaseImage cache image={avatar} className="size-5 rounded-full select-none" />
          <span className="text-[12px]">{summary?.creator.nickname}</span>
          <span className="select-none">
            <span className="underline">{RendererFormat.time(summary?.createTime)}</span> 创建
          </span>
        </div>
      </div>
    </div>
  );
};
export default memo(TopRight);
