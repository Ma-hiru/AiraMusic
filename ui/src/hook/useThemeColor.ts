import { useEffect, useState } from "react";
import { UI } from "@mahiru/ui/utils/ui";

export function useThemeColor() {
  const [themeColor, setThemeColor] = useState({
    mainColor: UI.APPThemeColorInstance.main,
    secondaryColor: UI.APPThemeColorInstance.secondary,
    textColorOnMain: UI.Utils.calcTextColorOn(UI.APPThemeColor.main)
  });
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const newThemeColor = {
        mainColor: UI.APPThemeColorInstance.main,
        secondaryColor: UI.APPThemeColorInstance.secondary,
        textColorOnMain: UI.Utils.calcTextColorOn(UI.APPThemeColor.main)
      };
      const hasChanged = !!Object.entries(themeColor).find(([key, color]) => {
        return color.string() !== newThemeColor[key as keyof typeof newThemeColor].string();
      });
      if (hasChanged) {
        setThemeColor(newThemeColor);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"]
    });
    return () => observer.disconnect();
  }, [themeColor]);

  return themeColor;
}
