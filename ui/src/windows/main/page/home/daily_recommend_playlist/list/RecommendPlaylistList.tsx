import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";

import RecommendTrackItem from "./RecommendPlaylistItem";

interface RecommendTrackListProps {
  recommend: NeteaseAPI.DailyRecommendPlaylistResult[];
}

const RecommendPlaylistList: FC<RecommendTrackListProps> = ({ recommend }) => {
  const { mainColor, textColorOnMain } = useThemeColor();

  return (
    <div
      className={cx(
        "relative w-full my-2 gap-2",
        css`
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          grid-auto-rows: auto;
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
