import { useLocation, useSearchParams } from "react-router-dom";
import { useCallback } from "react";

type Source = "like" | "history" | "recommend" | "playlist";

export function usePlaylistRouter() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const getPlaylistSource = useCallback(() => {
    return searchParams.get("source") as Source;
  }, [searchParams]);
  const shouldPlaylistIDIs = useCallback(
    (id: Optional<number | string>) => {
      return location.pathname === getPlaylistRouterPath(id);
    },
    [location.pathname]
  );
  return {
    getPlaylistSource,
    getPlaylistRouterPath,
    shouldPlaylistIDIs,
    searchParams,
    location
  };
}

export function getPlaylistRouterPath(id: Optional<number | string>, source?: Source) {
  if (!source) return `/playlist/${id}`;
  return `/playlist/${id}?source=${source}`;
}
