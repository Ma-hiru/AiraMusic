import { cx } from "@emotion/css";
import { memo, useState, useEffect, useCallback } from "react";
import type { NeteaseUser } from "@/common/netease/models";

import StarAlbumView from "./album-view";
import StarArtistView from "./artist-view";
import StarPlaylistView from "./playlist-view";
import type { StarCategory, StarViewMode } from "./types";

interface StarContentProps {
  user: NeteaseUser;
  className?: string;
  active: StarCategory;
  refreshToken?: number;
  routerActive: boolean;
  viewMode?: StarViewMode;
  onClickAlbum?: NormalFunc<[id: number]>;
  onClickArtist?: NormalFunc<[id: number]>;
  onClickPlaylist?: NormalFunc<[id: number]>;
  onCountChange: NormalFunc<[category: StarCategory, count: number]>;
}

const categoryIndex: Record<StarCategory, number> = {
  playlist: 0,
  album: 1,
  artist: 2
};

/** 分类内容区：首次切换才挂载，之后保留状态与滚动位置 */
const StarContent = ({
  user,
  className,
  onClickAlbum,
  onClickArtist,
  onCountChange,
  onClickPlaylist,
  active,
  viewMode,
  refreshToken,
  routerActive
}: StarContentProps) => {
  const [mounted, setMounted] = useState(0);

  useEffect(() => {
    setMounted((bit) => bit | (1 << categoryIndex[active]));
  }, [active]);

  const onPlaylistCountChange = useCallback(
    (count: number) => onCountChange("playlist", count),
    [onCountChange]
  );
  const onAlbumCountChange = useCallback(
    (count: number) => onCountChange("album", count),
    [onCountChange]
  );
  const onArtistCountChange = useCallback(
    (count: number) => onCountChange("artist", count),
    [onCountChange]
  );

  return (
    <div className={cx("relative min-h-0 flex-1", className)}>
      {!!(mounted & 0b1) && (
        <StarPlaylistView
          className={cx("h-full", active !== "playlist" && "hidden")}
          user={user}
          viewMode={viewMode}
          refreshToken={active === "playlist" ? refreshToken : undefined}
          onClick={onClickPlaylist}
          onCountChange={onPlaylistCountChange}
        />
      )}
      {!!(mounted & 0b10) && (
        <StarAlbumView
          className={cx("h-full", active !== "album" && "hidden")}
          viewMode={viewMode}
          active={routerActive}
          refreshToken={active === "album" ? refreshToken : undefined}
          onClick={onClickAlbum}
          onCountChange={onAlbumCountChange}
        />
      )}
      {!!(mounted & 0b100) && (
        <StarArtistView
          className={cx("h-full", active !== "artist" && "hidden")}
          viewMode={viewMode}
          active={routerActive}
          refreshToken={active === "artist" ? refreshToken : undefined}
          onClick={onClickArtist}
          onCountChange={onArtistCountChange}
        />
      )}
    </div>
  );
};

export default memo(StarContent);
