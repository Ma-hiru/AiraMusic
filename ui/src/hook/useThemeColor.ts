import { useEffect, useState } from "react";
import { getAPPThemeColor } from "@mahiru/ui/utils/ui";

export function useThemeColor() {
  const [mainColor, setMainColor] = useState(() => getAPPThemeColor().main);
  const [secondaryColor, setSecondaryColor] = useState(() => getAPPThemeColor().secondary);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const { main: newMain, secondary: newSecondary } = getAPPThemeColor();
      if (mainColor !== newMain) {
        setMainColor(newMain);
      }
      if (secondaryColor !== newSecondary) {
        setSecondaryColor(newSecondary);
      }
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style"]
    });
    return () => {
      observer.disconnect();
    };
  }, [mainColor, secondaryColor]);

  return { mainColor, secondaryColor };
}
