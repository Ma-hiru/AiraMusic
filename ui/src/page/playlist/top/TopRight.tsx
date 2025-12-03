import { FC, memo } from "react";
import { SquarePen } from "lucide-react";
import Search from "@mahiru/ui/page/playlist/Top/Search";
import { formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { useFileCache } from "@mahiru/ui/ctx/BlobCachedCtx";
import { ImageSize, NeteaseImageSizeFilter } from "@mahiru/ui/utils/filter";
import { useSearchParams } from "react-router-dom";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playList";

interface TopRightProps {
  entry: Nullable<PlaylistCacheEntry>;
  searchTracks: (k: string) => void;
}

const TopRight: FC<TopRightProps> = ({ entry, searchTracks }) => {
  const { data } = usePersistZustandShallowStore(["data"]);
  const [searchParams] = useSearchParams();
  const isLikedList = searchParams.get("like") === "true";
  const isHistoryList = searchParams.get("history") === "true";
  const cachedAvatar = useFileCache(
    NeteaseImageSizeFilter(entry?.playlist.creator.avatarUrl, ImageSize.sm)
  );
  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px] text-[#7b8290]/80">
      {/*EditBtn*/}
      <div className="size-5">
        {entry?.playlist.creator.userId === data.user?.userId && !isLikedList && (
          <SquarePen className="size-5 cursor-pointer select-none hover:text-[#7b8290]/50 active:text-[#7b8290]/90" />
        )}
      </div>
      {/*Info*/}
      <div className="flex flex-col items-end justify-end">
        <Search searchTracks={searchTracks} />
        <div className="flex items-center gap-2 mt-2 font-semibold">
          <img
            src={cachedAvatar as string}
            loading="lazy"
            decoding="async"
            className="size-5 rounded-full select-none"
            alt={entry?.playlist.creator.nickname}
          />
          <span className="text-[12px]">{entry?.playlist.creator.nickname}</span>
          <span className="select-none">{formatTimeToMMDD(entry?.playlist.createTime)} 创建</span>
        </div>
      </div>
    </div>
  );
};
export default memo(TopRight);
