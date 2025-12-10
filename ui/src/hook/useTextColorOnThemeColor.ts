import { calcTextColorOn, getAPPThemeColor } from "@mahiru/ui/utils/ui";
import { useEffect, useState } from "react";

export function useTextColorOnThemeColor() {
  const [mainColor, setMainColor] = useState(() => getAPPThemeColor().main);
  const [textColor, setTextColor] = useState(() => calcTextColorOn(mainColor).hex());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const { main: newMain } = getAPPThemeColor();
      if (mainColor !== newMain) {
        setMainColor(newMain);
      }
      const newTextColor = calcTextColorOn(newMain).hex();
      if (textColor !== newTextColor) {
        setTextColor(newTextColor);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"]
    });
    return () => {
      observer.disconnect();
    };
  }, [mainColor, textColor]);
  useEffect(() => {
    calcTextColorOn(mainColor).hex();
  }, [mainColor]);

  return textColor;
}
