import { useEffect, useState } from "react";
import { UI } from "@mahiru/ui/utils/ui";

export function useThemeColor() {
  const [themeColor, setThemeColor] = useState({
    mainColor: UI.APPThemeColorInstance.main,
    secondaryColor: UI.APPThemeColorInstance.secondary,
    textColorOnMain: UI.Utils.calcTextColorOn(UI.APPThemeColor.main)
  });

  useEffect(() => {
    let canceled = false;
    const observer = new MutationObserver(() => {
      requestIdleCallback(() => {
        if (canceled) return;
        setThemeColor((prev) => {
          const next = {
            mainColor: UI.APPThemeColorInstance.main,
            secondaryColor: UI.APPThemeColorInstance.secondary,
            textColorOnMain: UI.Utils.calcTextColorOn(UI.APPThemeColor.main)
          };
          const changed = Object.keys(prev).some(
            (k) => prev[k as keyof typeof prev].string() !== next[k as keyof typeof next].string()
          );
          return changed ? next : prev;
        });
      });
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"]
    });
    return () => {
      observer.disconnect();
      canceled = true;
    };
  }, []);

  return themeColor;
}
