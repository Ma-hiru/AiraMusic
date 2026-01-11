import { FC, memo } from "react";
import { SquarePen } from "lucide-react";
import { PlaylistCacheEntry } from "@mahiru/ui/public/entry/playlist";
import { usePlaylistRouter } from "@mahiru/ui/main/hooks/usePlaylistRouter";
import { useLocalStore } from "@mahiru/ui/public/store/local";
import { useFileCache } from "@mahiru/ui/public/hooks/useFileCache";
import { NeteaseImage } from "@mahiru/ui/public/entry/image";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { Time } from "@mahiru/ui/public/entry/time";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";

import Search from "@mahiru/ui/public/components/public/Search";

interface TopRightProps {
  entry: Nullable<PlaylistCacheEntry>;
  searchTracks: (k: string) => void;
}

const TopRight: FC<TopRightProps> = ({ entry, searchTracks }) => {
  const {
    User: { UserProfile }
  } = useLocalStore(["User"]);
  const { SetIsTyping } = useLayoutStore(["SetIsTyping"]);
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
        <Search searchTracks={searchTracks} setIsTyping={SetIsTyping} />
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
