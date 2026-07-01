import { memo, type FC } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RecommendTrackTitleProps {
  lastPage: NormalFunc;
  nextPage: NormalFunc;
}

const RecommendTrackTitle: FC<RecommendTrackTitleProps> = ({ lastPage, nextPage }) => {
  return (
    <div className="mb-3 flex items-end justify-between gap-3 px-2">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">Daily Songs</p>
        <h2 className="truncate text-xl font-bold">每日精选歌曲</h2>
      </div>
      <div className="flex items-center justify-center gap-2">
        <button
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/5 transition-all duration-300 hover:bg-white/20 active:scale-95"
          title="上一页"
          onClick={lastPage}>
          <ChevronLeft className="size-4" />
        </button>
        <button
          className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/5 transition-all duration-300 hover:bg-white/20 active:scale-95"
          title="下一页"
          onClick={nextPage}>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
};
export default memo(RecommendTrackTitle);
