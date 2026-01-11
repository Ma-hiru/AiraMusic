import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { useThemeColor } from "@mahiru/ui/public/hooks/useThemeColor";
import { useInnerWidth } from "@mahiru/ui/public/hooks/useInnerWidth";

import PlaylistItem from "./PlaylistItem";

interface RecommendTrackListProps {
  recommend: RecommendPlaylistResult[];
}

const PlaylistList: FC<RecommendTrackListProps> = ({ recommend }) => {
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
        <PlaylistItem
          key={playlist.id}
          playlist={playlist}
          isMainColorDark={mainColor.isDark()}
          textColor={textColorOnMain.string()}
        />
      ))}
    </div>
  );
};
export default memo(PlaylistList);
