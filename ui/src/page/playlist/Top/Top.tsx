import { FC, memo, useEffect, useState } from "react";
import { formatTimeToMMDD } from "@mahiru/ui/utils/time";
import { ListMusic, Play, SquarePen } from "lucide-react";
import { usePersistZustandShallowStore } from "@mahiru/ui/store";
import { NeteasePlaylistDetailResponse } from "@mahiru/ui/types/netease-api";
import { wrapCacheUrl } from "@mahiru/ui/api/cache";
import Search from "@mahiru/ui/page/playlist/Top/Search";
import TopCover from "@mahiru/ui/page/playlist/Top/TopCover";
import TopRight from "@mahiru/ui/page/playlist/Top/TopRight";
import TopInfo from "@mahiru/ui/page/playlist/Top/TopInfo";

interface TopProps {
  detail: Nullable<NeteasePlaylistDetailResponse>;
  searchTracks: (k: string) => void;
}

const Top: FC<TopProps> = ({ detail, searchTracks }) => {
  return (
    <div className="grid grid-rows-1 grid-cols-[1fr_auto]">
      {/*Left*/}
      <div className="min-w-0 grid grid-rows-1 grid-cols-[auto_1fr] gap-4 items-center">
        <TopCover detail={detail} />
        {/*Info*/}
        <TopInfo detail={detail} />
      </div>
      {/*Right*/}
      <TopRight detail={detail} searchTracks={searchTracks} />
    </div>
  );
};
export default memo(Top);
