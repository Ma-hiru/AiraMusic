import { FC, memo } from "react";
import TopCover from "./TopCover";
import TopRight from "./TopRight";
import TopInfo from "./TopInfo";
import { PlaylistCacheEntry } from "@mahiru/ui/utils/playlist";

interface TopProps {
  entry: Nullable<PlaylistCacheEntry>;
  searchTracks: (k: string) => void;
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: Nullable<number[]> };
}

const Top: FC<TopProps> = ({ entry, searchTracks, filterTracks }) => {
  return (
    <div className="grid grid-rows-1 grid-cols-[1fr_auto]">
      {/*Left*/}
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-center">
        <TopCover entry={entry} />
        {/*Info*/}
        <TopInfo entry={entry} filterTracks={filterTracks} />
      </div>
      {/*Right*/}
      <TopRight entry={entry} searchTracks={searchTracks} />
    </div>
  );
};
export default memo(Top);
