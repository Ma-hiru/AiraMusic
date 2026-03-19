import { FC, memo } from "react";

import TopCover from "./TopCover";
import TopRight from "./TopRight";
import TopInfo from "./TopInfo";
import { NeteasePlaylist } from "@mahiru/ui/public/models/netease";
import { PlaylistSource } from "@mahiru/ui/main/constants";

interface TopProps {
  type: PlaylistSource;
  loading: boolean;
  summary: Nullable<NeteasePlaylist>;
  searchTracks: NormalFunc<[k: string]>;
  onPlayAll: NormalFunc;
  onAddList: NormalFunc;
}

const Top: FC<TopProps> = ({ summary, searchTracks, onPlayAll, onAddList, type, loading }) => {
  return (
    <div className="grid grid-rows-1 grid-cols-[1fr_auto]">
      {/*Left*/}
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-center">
        <TopCover summary={summary} />
        {/*Info*/}
        <TopInfo summary={summary} onAddList={onAddList} onPlayAll={onPlayAll} />
      </div>
      {/*Right*/}
      <TopRight summary={summary} type={type} searchTracks={searchTracks} />
    </div>
  );
};
export default memo(Top);
