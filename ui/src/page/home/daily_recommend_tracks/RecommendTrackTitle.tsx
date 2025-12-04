import { FC, memo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Color from "color";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface RecommendTrackTitleProps {
  lastPage: NormalFunc;
  nextPage: NormalFunc;
}

const RecommendTrackTitle: FC<RecommendTrackTitleProps> = ({ lastPage, nextPage }) => {
  const { mainColor } = useThemeColor();
  const titleColor = Color("#000000").mix(Color(mainColor), 0.2).string();
  return (
    <div className="flex justify-between items-center" style={{ color: titleColor }}>
      <h2 className="font-bold text-lg">每日精选歌曲</h2>
      <div className="justify-center items-center flex gap-2">
        <ChevronLeft className="size-4 cursor-pointer" onClick={lastPage} />
        <ChevronRight className="size-4 cursor-pointer" onClick={nextPage} />
      </div>
    </div>
  );
};
export default memo(RecommendTrackTitle);
