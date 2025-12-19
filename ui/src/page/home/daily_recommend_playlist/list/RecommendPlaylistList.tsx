import RecommendTrackItem from "./RecommendPlaylistItem";
import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { useInnerWidth } from "@mahiru/ui/hook/useInnerWidth";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface RecommendTrackListProps {
  recommend: DailyRecommendPlaylistResult[];
}

const RecommendPlaylistList: FC<RecommendTrackListProps> = ({ recommend }) => {
  const { mainColor, textColorOnMain } = useThemeColor();
  const innerWidth = useInnerWidth();

  return (
    <div
      className={cx(
        "relative w-full my-2 grid gap-2",
        css`
          grid-template-columns: repeat(${Math.floor(innerWidth / 200)}, minmax(0, 1fr));
        `
      )}>
      {recommend.map((playlist) => (
        <RecommendTrackItem
          key={playlist.id}
          playlist={playlist}
          isMainColorDark={mainColor.isDark()}
          textColor={textColorOnMain.string()}
        />
      ))}
    </div>
  );
};
export default memo(RecommendPlaylistList);
