import { useRouterActive } from "@/common/hooks/use-router-active";
import { useCallback, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useSetAtom } from "jotai";
import { backgroundCoverAtom } from "@/wins/main/atoms/theme";

export function useSetBackground() {
  const active = useRouterActive(useLocation());
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
