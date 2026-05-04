import AppUI from "@mahiru/ui/public/player/ui";
import { useLayoutEffect, useRef, useState } from "react";
import { useThemeInjectFromBus } from "@mahiru/ui/public/hooks/useThemeInjectFromBus";

function getColor() {
  const { main, secondary, textOnMainColor } = AppUI.themeInstance;
  return {
    mainColor: main,
    secondaryColor: secondary,
    textColorOnMain: textOnMainColor
  };
}

export function useThemeColor() {
  useThemeInjectFromBus();

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

  useLayoutEffect(() => AppUI.addListener(updateColor), [updateColor]);

  return themeColor;
}
