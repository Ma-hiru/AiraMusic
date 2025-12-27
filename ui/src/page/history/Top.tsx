import { FC, memo } from "react";
import Title from "@mahiru/ui/componets/public/Title";
import Search from "@mahiru/ui/componets/public/Search";

interface TopProps {
  searchTracks: NormalFunc<[k: string]>;
  recordCount: number;
}

const Top: FC<TopProps> = ({ searchTracks, recordCount }) => {
  return (
    <div className="mb-1">
      <Title
        title={
          <div className="flex items-center">
            <span>历史记录</span>
            <span className="text-black/30 scale-80">({recordCount} 记录)</span>
          </div>
        }
        slot={<Search searchTracks={searchTracks} />}
      />
    </div>
  );
};
export default memo(Top);
