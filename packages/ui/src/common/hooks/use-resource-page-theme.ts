import {
  useRef,
  useState,
  useContext,
  useCallback,
  createContext,
  type Dispatch,
  useLayoutEffect,
  type SetStateAction
} from "react";
import { RendererCache } from "@/common/lib/cache";
import { applyMonetPalette, type MonetPalettes } from "@/common/player/monet";

import { useMonet } from "./use-monet";

export interface ResourceBackdrop {
  src: string;
  themeColors?: string[];
  palette?: MonetPalettes;
}

export const ResourceBackdropContext = createContext<null | Dispatch<
  SetStateAction<undefined | ResourceBackdrop>
>>(null);

export function useResourcePageTheme(
  cover: string | undefined,
  active: boolean,
  onLoad?: NormalFunc<[src: string]>
) {
  const ref = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<{ src: string; cover: string }>();
  const url = loaded?.cover === cover ? loaded?.src : undefined;
  const { colors } = useMonet({ url });
  const palette = colors?.palettes;
  const setBackdrop = useContext(ResourceBackdropContext);

  const onImageLoad = useCallback(
    (src: string) => {
      if (cover && src) {
        const resolved = RendererCache.service.read.updateKey(src);
        setLoaded((prev) =>
          prev?.cover === cover && prev.src === resolved ? prev : { cover, src: resolved }
        );
      }
      onLoad?.(src);
    },
    [cover, onLoad]
  );

  useLayoutEffect(() => {
    if (ref.current) applyMonetPalette(palette ?? null, ref.current.style);
  }, [palette]);

  useLayoutEffect(() => {
    if (!active || !url || !setBackdrop) return;
    const backdrop = { src: url, palette: colors?.palettes, themeColors: colors?.coverColors };
    setBackdrop(backdrop);
    return () => setBackdrop((current) => (current === backdrop ? undefined : current));
  }, [active, colors, setBackdrop, url]);

  return { ref, onImageLoad, ready: !!palette };
}
