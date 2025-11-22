import { FC, memo } from "react";
import { SquarePen } from "lucide-react";
import Search from "@mahiru/ui/page/playlist/Top/Search";
import { formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { setImageURLSize } from "@mahiru/ui/utils/setImageSize";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";

interface TopRightProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
  searchTracks: (k: string) => void;
}

const TopRight: FC<TopRightProps> = ({ detail, searchTracks }) => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const cachedAvatar = useFileCache(setImageURLSize(detail?.playlist.creator.avatarUrl, "md"));
  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px] text-[#7b8290]/80">
      {/*EditBtn*/}
      <div className="size-5">
        {detail?.playlist.creator.userId === data.user?.userId && (
          <SquarePen className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90" />
        )}
      </div>
      {/*Info*/}
      <div className="flex flex-col items-end justify-end">
        <Search searchTracks={searchTracks} />
        <div className="flex items-center gap-2 mt-2 font-semibold">
          <img
            src={cachedAvatar as string}
            className="size-5 rounded-full select-none"
            alt={detail?.playlist.creator.nickname}
          />
          <span className="text-[12px]">{detail?.playlist.creator.nickname}</span>
          <span>{formatTimeToMMDD(detail?.playlist.createTime)} 创建</span>
        </div>
      </div>
    </div>
  );
};
export default memo(TopRight);
