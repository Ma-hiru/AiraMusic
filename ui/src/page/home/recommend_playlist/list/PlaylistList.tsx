import Color from "color";
import RecommendTrackItem from "./PlaylistItem";
import { FC, memo } from "react";
import { css, cx } from "@emotion/css";
import { useInnerWidth } from "@mahiru/ui/hook/useInnerWidth";
import { useTextColorOnThemeColor } from "@mahiru/ui/hook/useTextColorOnThemeColor";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

interface RecommendTrackListProps {
  recommend: RecommendPlaylistResult[];
}

const PlaylistList: FC<RecommendTrackListProps> = ({ recommend }) => {
  const { mainColor } = useThemeColor();
  const innerWidth = useInnerWidth();
  const textColor = useTextColorOnThemeColor();
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
          mainColor={Color(mainColor).alpha(0.5).string()}
          textColor={textColor}
        />
      ))}
    </div>
  );
};
export default memo(PlaylistList);
