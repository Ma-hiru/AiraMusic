import { useRouterActive } from "@mahiru/ui/common/hooks/useRouterActive";
import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSetAtom } from "jotai";
import { backgroundCoverAtom } from "@mahiru/ui/windows/main/atoms/theme";

export function useCoverLoadedAndSetTheme() {
  const location = useLocation();
  const active = useRouterActive(location);
  const coverRef = useRef("");
  const setBackground = useSetAtom(backgroundCoverAtom);

  const onCoverLoaded = useCallback(
    (src: string) => {
      setBackground(src);
      coverRef.current = src;
    },
    [setBackground]
  );

  useEffect(() => {
    const cover = coverRef.current;
    cover && onCoverLoaded(cover);
  }, [onCoverLoaded, active]);

  return {
    onCoverLoaded
  };
}
