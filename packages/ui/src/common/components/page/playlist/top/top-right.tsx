import { type FC, memo, useMemo } from "react";
import { SquareArrowRightEnter, SquareArrowRightExit, SquarePen } from "lucide-react";
import { NeteasePlaylist } from "@/common/netease/models";
import { useUser } from "@/common/store/user";
import { PlaylistSource } from "@/common/enum";

import Search from "@/common/components/public/search";

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
  const action = useMemo(() => {
    if (pageActionType === "enter")
      return (
        <SquareArrowRightEnter
          className="size-5 cursor-pointer select-none ease-in-out transition-all duration-300 hover:opacity-50"
          onClick={onPageAction}
        />
      );
    if (pageActionType === "out")
      return (
        <SquareArrowRightExit
          className="size-5 cursor-pointer select-none ease-in-out transition-all duration-300 hover:opacity-50"
          onClick={onPageAction}
        />
      );
    return null;
  }, [onPageAction, pageActionType]);

  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px]">
      <div className="flex items-center gap-2">
        {/*EditBtn*/}
        <div className="size-5">
          {summary?.creator?.userId === user?.profile.userId && type !== "like" && (
            <SquarePen className="size-5 cursor-pointer select-none hover:opacity-50 ease-in-out transition-all duration-300" />
          )}
        </div>
        {action}
      </div>
      {/*Info*/}
      <div className="flex flex-col items-end justify-end">
        <Search searchTracks={searchTracks} setIsTyping={setTying} />
      </div>
    </div>
  );
};
export default memo(TopRight);
