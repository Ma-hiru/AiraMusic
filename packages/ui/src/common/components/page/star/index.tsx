import { cx } from "@emotion/css";
import { memo, useRef, type FC, useMemo, useState, useEffect, useCallback } from "react";
import type { NeteaseUser } from "@/common/netease/models";

import StarHeader from "./header";
import StarContent from "./content";
import StarLoginTips from "./login-tips";
import type { StarCategory, StarViewMode } from "./types";

const VIEW_MODE_KEY = "star-view-mode";

function getInitialViewMode(): StarViewMode {
  return window.localStorage.getItem(VIEW_MODE_KEY) === "list" ? "list" : "grid";
}

interface StarProps {
  className?: string;
  routerActive: boolean;
  user: Nullable<NeteaseUser>;
  pageActionType?: "out" | "none" | "enter";
  onLogin?: NormalFunc;
  onPageAction?: NormalFunc;
  onClickAlbum?: NormalFunc<[id: number]>;
  onClickArtist?: NormalFunc<[id: number]>;
  onClickPlaylist?: NormalFunc<[id: number]>;
}

const Star: FC<StarProps> = ({
  user,
  className,
  pageActionType,
  onLogin,
  onClickAlbum,
  onPageAction,
  onClickArtist,
  onClickPlaylist,
  routerActive
}) => {
  const [active, setActive] = useState<StarCategory>("playlist");
  const [counts, setCounts] = useState<Partial<Record<StarCategory, number>>>({});
  const [viewMode, setViewMode] = useState<StarViewMode>(getInitialViewMode);
  const [refreshToken, setRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshTimerRef = useRef<Undefinable<number>>(undefined);

  const onCountChange = useCallback((category: StarCategory, count: number) => {
    setCounts((prev) => (prev[category] === count ? prev : { ...prev, [category]: count }));
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshToken((token) => token + 1);
    setRefreshing(true);
    window.clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = window.setTimeout(() => setRefreshing(false), 900);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => setCounts({}), [user?.userId]);

  useEffect(() => () => window.clearTimeout(refreshTimerRef.current), []);

  const displayCounts = useMemo(() => {
    if (!user) return counts;
    return { ...counts, playlist: user.starPlaylists?.length ?? 0 };
  }, [counts, user]);

  const loggedIn = Boolean(user?.isLoggedIn);

  return (
    <div className={cx("flex h-full min-h-0 flex-col overflow-hidden", className)}>
      <StarHeader
        className="mb-4"
        active={active}
        showTabs={loggedIn}
        viewMode={viewMode}
        counts={displayCounts}
        refreshing={refreshing}
        pageActionType={pageActionType}
        onChange={setActive}
        onRefresh={onRefresh}
        onPageAction={onPageAction}
        onViewModeChange={setViewMode}
      />
      {loggedIn && user ? (
        <StarContent
          key={user.userId}
          className="min-h-0"
          user={user}
          active={active}
          viewMode={viewMode}
          refreshToken={refreshToken}
          routerActive={routerActive}
          onClickAlbum={onClickAlbum}
          onClickArtist={onClickArtist}
          onCountChange={onCountChange}
          onClickPlaylist={onClickPlaylist}
        />
      ) : (
        <StarLoginTips className="flex-1" onLogin={onLogin} />
      )}
    </div>
  );
};

export default memo(Star);
