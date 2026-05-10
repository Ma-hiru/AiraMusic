import { useRouterActive } from "@mahiru/ui/public/hooks/useRouterActive";
import { useCallback, useEffect, useRef } from "react";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";
import { useLocation } from "react-router-dom";

export function useCoverLoadedAndSetTheme() {
  const location = useLocation();
  const active = useRouterActive(location);
  const coverRef = useRef("");

  const onCoverLoaded = useCallback((src: string) => {
    const { theme, updateTheme } = getLayoutStoreSnapshot();
    updateTheme(theme.copy().setBackgroundCover(src));
    coverRef.current = src;
  }, []);

  useEffect(() => {
    const cover = coverRef.current;
    cover && onCoverLoaded(cover);
  }, [onCoverLoaded, active]);

  return {
    onCoverLoaded
  };
}
