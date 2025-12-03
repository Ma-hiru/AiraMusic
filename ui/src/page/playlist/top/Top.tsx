import { FC, memo } from "react";
import TopCover from "@mahiru/ui/page/playlist/Top/TopCover";
import TopRight from "@mahiru/ui/page/playlist/Top/TopRight";
import TopInfo from "@mahiru/ui/page/playlist/Top/TopInfo";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playList";

interface TopProps {
  entry: Nullable<PlaylistCacheEntry>;
  searchTracks: (k: string) => void;
}

const Top: FC<TopProps> = ({ entry, searchTracks }) => {
  return (
    <div className="grid grid-rows-1 grid-cols-[1fr_auto]">
      {/*Left*/}
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-center">
        <TopCover entry={entry} />
        {/*Info*/}
        <TopInfo entry={entry} />
      </div>
      {/*Right*/}
      <TopRight entry={entry} searchTracks={searchTracks} />
    </div>
  );
};
export default memo(Top);
