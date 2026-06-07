import { cx } from "@emotion/css";
import { type FC, memo, useEffect, useState } from "react";
import { useUser } from "@/common/store/user";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useSetBackground } from "@/wins/main/hooks/use-set-background";
import { useAtomValue } from "jotai";
import { backgroundCoverAtom } from "@/wins/main/atoms/theme";
import { NeteaseURL } from "@/common/netease/models";
import { NeteaseImageSize } from "@/common/enum";

import DailyRecommendTracks from "./daily-recommend-tracks";
import DailyRecommendPlaylist from "./daily-recommend-playlist";
import NewAlbums from "./new-albums";
import RecommendArtists from "./recommend-artists";
import RecommendPlaylist from "./recommend-playlist";
import Toplists from "./toplists";

const HomeRecommendView: FC<{ className?: string }> = ({ className }) => {
  const user = useUser();
  const background = useAtomValue(backgroundCoverAtom);
  const [selectedCover, setSelectedCover] = useState("");
  const { setBackground } = useSetBackground("home");
  const { jumpPlaylistPage, jumpArtistPage, jumpAlbumPage } = usePageJump();

  useEffect(() => {
    if (background) return;
    setBackground(NeteaseURL.setImageSize(selectedCover, NeteaseImageSize.md));
  }, [background, selectedCover, setBackground]);

  return (
    <div className={cx("flex flex-col gap-3", className)}>
      {user?.isLoggedIn && (
        <DailyRecommendPlaylist
          onDataLoaded={(data) => {
            setSelectedCover(data[0]?.picUrl ?? "");
          }}
          onClickItem={(id) => jumpPlaylistPage(id, "normal")}
          key={user.profile.userId + "-daily-playlist"}
        />
      )}
      {user?.isLoggedIn && <DailyRecommendTracks key={user.profile.userId + "-daily-tracks"} />}
      <RecommendPlaylist
        onDataLoaded={(data) => {
          if (user?.isLoggedIn) return;
          setSelectedCover(data[1]?.picUrl ?? "");
        }}
        onClickItem={(id) => jumpPlaylistPage(id, "normal")}
        key={user?.isLoggedIn ? user.profile.userId + "-playlist" : "guest-playlist"}
      />
      <RecommendArtists onClickItem={jumpArtistPage} />
      <NewAlbums onClickItem={jumpAlbumPage} />
      <Toplists onClickItem={(id) => jumpPlaylistPage(id, "normal")} />
    </div>
  );
};

export default memo(HomeRecommendView);
