import { FC, memo, useMemo } from "react";
import { SquarePen } from "lucide-react";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import {
  NeteaseNetworkImage,
  NeteasePlaylist,
  NeteaseTrack
} from "@mahiru/ui/public/models/netease";
import { useUser } from "@mahiru/ui/public/store/user";
import { PlaylistSource } from "@mahiru/ui/main/constants";

import Search from "@mahiru/ui/public/components/public/Search";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";

interface TopRightProps {
  summary: Nullable<NeteasePlaylist>;
  type: PlaylistSource;
  searchTracks: NormalFunc<[k: string]>;
  setTying: NormalFunc<[typing: boolean]>;
}

const TopRight: FC<TopRightProps> = ({ summary, searchTracks, type, setTying }) => {
  const user = useUser();

  const avatar = useMemo(() => {
    if (!summary) return;
    return NeteaseNetworkImage.fromUserAvatar(summary.creator)
      ?.setSize(NeteaseImageSize.sm)
      .setAlt(summary.creator.nickname);
  }, [summary]);

  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px] text-[#7b8290]/80">
      {/*EditBtn*/}
      <div className="size-5">
        {summary?.creator?.userId === user?.profile.userId && type !== "like" && (
          <SquarePen className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90" />
        )}
      </div>
      {/*Info*/}
      <div className="flex flex-col items-end justify-end">
        <Search searchTracks={searchTracks} setIsTyping={setTying} />
        <div className="flex items-center gap-2 mt-2 font-semibold">
          <NeteaseImage cache image={avatar} className="size-5 rounded-full select-none" />
          <span className="text-[12px]">{summary?.creator.nickname}</span>
          <span className="select-none">{NeteaseTrack.formatDate(summary?.createTime)} 创建</span>
        </div>
      </div>
    </div>
  );
};
export default memo(TopRight);
