import { useSetAtom } from "jotai";
import { useRef, useEffect, useCallback } from "react";
import { RoutePathMain } from "@/common/routes";
import { backgroundCoverAtom } from "@/wins/main/atoms/theme";
import { useRouterActive } from "@/common/hooks/use-router-active";

export function useSetBackground(page: keyof typeof RoutePathMain) {
  const active = useRouterActive(RoutePathMain, page);
  const coverRef = useRef("");
  const setBackgroundCover = useSetAtom(backgroundCoverAtom);

  const setBackground = useCallback(
    (src: string) => {
      setBackgroundCover(src);
      coverRef.current = src;
    },
    [setBackgroundCover]
  );

  useEffect(() => {
    const cover = coverRef.current;
    cover && setBackground(cover);
  }, [setBackground, active]);

  return {
    setBackground
  };
}
