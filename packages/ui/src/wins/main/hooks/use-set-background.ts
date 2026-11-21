import { useSetAtom } from "jotai";
import { useLocation } from "react-router-dom";
import { useRef, useEffect, useCallback } from "react";
import { RoutePathMain } from "@/common/routes";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { backgroundCoverAtom } from "@/wins/main/atoms/theme";

export function useSetBackground(page: "home" | "album" | "artist" | "playlist") {
  const location = useLocation();
  const active = RoutePathMain.matchPathname(location, RoutePathMain[page]);
  const activeRef = useLatestRef(active);
  const coverRef = useRef("");
  const setBackgroundCover = useSetAtom(backgroundCoverAtom);

  const setBackground = useCallback(
    (src: string) => {
      coverRef.current = src;
      if (activeRef.current) setBackgroundCover(src);
    },
    [activeRef, setBackgroundCover]
  );

  useEffect(() => {
    const cover = coverRef.current;
    if (active && cover) setBackgroundCover(cover);
  }, [active, setBackgroundCover]);

  return {
    setBackground
  };
}
