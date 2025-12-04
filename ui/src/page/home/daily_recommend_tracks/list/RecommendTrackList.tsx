import Color from "color";
import RecommendTrackItem from "./RecommendTrackItem";
import { FC, memo, RefObject } from "react";
import { css, cx } from "@emotion/css";
import { useInnerWidth } from "@mahiru/ui/hook/useInnerWidth";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface RecommendTrackListProps {
  recommend: DailyRecommendTracksDailySong[];
  containerRef: RefObject<Nullable<HTMLDivElement>>;
}

const RecommendTrackList: FC<RecommendTrackListProps> = ({ recommend, containerRef }) => {
  const { mainColor } = useThemeColor();
  const innerWidth = useInnerWidth();
  const textColor = useTextColorOnThemeColor();
  return (
    <div
      ref={containerRef}
      className={cx(
        "relative w-full my-2 overflow-y-auto scrollbar-hide scroll-smooth ",
        css`
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: calc(100% / ${Math.floor(innerWidth / 170)});
          scroll-snap-type: x mandatory;
        `
      )}>
      {recommend.map((song) => (
        <div key={song.id} className="snap-start">
          <RecommendTrackItem
            song={song}
            mainColor={Color(mainColor).alpha(0.5).string()}
            textColor={textColor}
          />
        </div>
      ))}
    </div>
  );
};
export default memo(RecommendTrackList);
