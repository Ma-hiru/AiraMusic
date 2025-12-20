import { useEffect, useState } from "react";
import { UI } from "@mahiru/ui/utils/ui";

const handlers = new Set<NormalFunc>();
const observer = new MutationObserver(() => {
  requestIdleCallback(() => {
    handlers.forEach((handler) => handler());
  });
});
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["style"]
});

export function useThemeColor() {
  const [themeColor, setThemeColor] = useState({
    mainColor: UI.APPThemeColorInstance.main,
    secondaryColor: UI.APPThemeColorInstance.secondary,
    textColorOnMain: UI.Utils.calcTextColorOn(UI.APPThemeColor.main)
  });

  useEffect(() => {
    let canceled = false;
    const updater = () => {
      if (canceled) return;
      setThemeColor((prev) => {
        const { main, secondary, textOnMainColor } = UI.APPThemeColorInstance;
        const next = {
          mainColor: main,
          secondaryColor: secondary,
          textColorOnMain: textOnMainColor
        };
        const changed = Object.keys(prev).some(
          (k) => prev[k as keyof typeof prev].string() !== next[k as keyof typeof next].string()
        );
        return changed ? next : prev;
      });
    };
    handlers.add(updater);
    return () => {
      handlers.delete(updater);
      canceled = true;
    };
  }, []);

  return themeColor;
}
