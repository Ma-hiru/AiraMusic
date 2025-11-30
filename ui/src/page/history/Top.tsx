import { FC, memo } from "react";
import Title from "@mahiru/ui/componets/public/Title";
import { NeteaseTrack } from "@mahiru/ui/types/netease-api";
import Dayjs from "dayjs";
import Search from "@mahiru/ui/page/history/Search";

interface TopProps {
  searchTracks: NormalFunc<[k: string]>;
  filterTracks: { tracks: NeteaseTrack[]; absoluteIdx: Nullable<number[]> };
  loading: boolean;
}

const Top: FC<TopProps> = ({ searchTracks, filterTracks, loading }) => {
  return (
    <div className="mb-1">
      <Title
        title={
          <div className="flex items-center">
            <span>历史记录</span>
            <span className="text-black/30 scale-80">
              ({filterTracks?.tracks?.length || 0} 记录)
            </span>
          </div>
        }
        slot={<Search searchTracks={searchTracks} />}
      />
    </div>
  );
};
export default memo(Top);
