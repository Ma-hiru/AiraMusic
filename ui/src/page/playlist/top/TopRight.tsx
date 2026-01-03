import { FC, memo } from "react";
import { SquarePen } from "lucide-react";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";
import { Time } from "@mahiru/ui/utils/time";

import Search from "@mahiru/ui/componets/public/Search";
import { usePlaylistRouter } from "@mahiru/ui/hook/usePlaylistRouter";
import { useUserStore } from "@mahiru/ui/store/user";
import { NeteaseImage, NeteaseImageSize } from "@mahiru/ui/utils/image";

interface TopRightProps {
  entry: Nullable<PlaylistCacheEntry>;
  searchTracks: (k: string) => void;
}

const TopRight: FC<TopRightProps> = ({ entry, searchTracks }) => {
  const { UserProfile } = useUserStore(["UserProfile"]);
  const { getPlaylistSource } = usePlaylistRouter();
  const isLikedList = getPlaylistSource() === "like";
  const cachedAvatar = useFileCache(
    NeteaseImage.setSize(entry?.playlist.creator.avatarUrl, NeteaseImageSize.sm)
  );
  return (
    <div className="flex h-full flex-col justify-between items-end text-[12px] text-[#7b8290]/80">
      {/*EditBtn*/}
      <div className="size-5">
        {entry?.playlist.creator.userId === UserProfile?.userId && !isLikedList && (
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
          <span className="select-none">
            {Time.formatTrackDate(entry?.playlist.createTime)} 创建
          </span>
        </div>
      </div>
    </div>
  );
};
export default memo(TopRight);
