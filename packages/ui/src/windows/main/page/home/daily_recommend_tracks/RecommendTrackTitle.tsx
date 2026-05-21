import { type FC, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RecommendTrackTitleProps {
  lastPage: NormalFunc;
  nextPage: NormalFunc;
}

const RecommendTrackTitle: FC<RecommendTrackTitleProps> = ({ lastPage, nextPage }) => {
  return (
    <div className="flex justify-between items-center text-(--text-color-on-main)">
      <h2 className="font-bold text-lg">每日精选歌曲</h2>
      <div className="justify-center items-center flex gap-2">
        <ChevronLeft className="size-4 cursor-pointer" onClick={lastPage} />
        <ChevronRight className="size-4 cursor-pointer" onClick={nextPage} />
      </div>
    </div>
  );
};
export default memo(RecommendTrackTitle);
