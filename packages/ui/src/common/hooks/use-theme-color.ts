import { useRef, useState, useLayoutEffect } from "react";
import RendererTheme from "@/common/player/ui";

function getColor() {
  const { main, secondary, textOnMainColor } = RendererTheme.themeInstance;
  return {
    mainColor: main,
    secondaryColor: secondary,
    textColorOnMain: textOnMainColor
  };
}

export function useThemeColor() {
  const [themeColor, setThemeColor] = useState(getColor);
  const updateColor = useRef(() => {
    setThemeColor((prev) => {
      const next = getColor();
      const changed = Object.keys(prev).some(
        (k) => prev[k as keyof typeof prev].string() !== next[k as keyof typeof next].string()
      );
      return changed ? next : prev;
    });
  }).current;

  useLayoutEffect(() => RendererTheme.addListener(updateColor), [updateColor]);

  return themeColor;
}
