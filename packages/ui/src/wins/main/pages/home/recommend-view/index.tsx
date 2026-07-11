import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, type FC, useState, useEffect } from "react";
import { useUser } from "@/common/store/user";
import { NeteaseImageSize } from "@/common/enum";
import { NeteaseURL } from "@/common/netease/models";
import { backgroundCoverAtom } from "@/wins/main/atoms/theme";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";

import Toplists from "./toplists";
import NewAlbums from "./new-albums";
import RecommendArtists from "./recommend-artists";
import RecommendPlaylist from "./recommend-playlist";
import DailyRecommendTracks from "./daily-recommend-tracks";
import DailyRecommendPlaylist from "./daily-recommend-playlist";

const HomeRecommendView: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const background = useAtomValue(backgroundCoverAtom);
  const [selectedCover, setSelectedCover] = useState("");
  const { setBackground } = useSetBackground("home");
  const { jumpAlbumPage, jumpArtistPage, jumpPlaylistPage } = usePageJump();

  useEffect(() => {
    if (background) return;
    setBackground(NeteaseURL.setImageSize(selectedCover, NeteaseImageSize.md));
  }, [background, selectedCover, setBackground]);

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {user?.isLoggedIn && (
        <DailyRecommendPlaylist
          key={user.profile.userId + "-daily-playlist"}
          onClickItem={(id) => jumpPlaylistPage(id, "normal")}
          onDataLoaded={(data) => {
            setSelectedCover(data[0]?.picUrl ?? "");
          }}
        />
      )}
      {user?.isLoggedIn && <DailyRecommendTracks key={user.profile.userId + "-daily-tracks"} />}
      <RecommendPlaylist
        key={user?.isLoggedIn ? user.profile.userId + "-playlist" : "guest-playlist"}
        onClickItem={(id) => jumpPlaylistPage(id, "normal")}
        onDataLoaded={(data) => {
          if (user?.isLoggedIn) return;
          setSelectedCover(data[1]?.picUrl ?? "");
        }}
      />
      <RecommendArtists onClickItem={jumpArtistPage} />
      <NewAlbums onClickItem={jumpAlbumPage} />
      <Toplists onClickItem={(id) => jumpPlaylistPage(id, "normal")} />
    </div>
  );
};

export default memo(HomeRecommendView);
