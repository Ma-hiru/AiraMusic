import { useEffect, useState } from "react";
import { readThemeColorByCSSVar } from "@mahiru/ui/utils/ui";

export function useThemeColor() {
  const [mainColor, setMainColor] = useState(() => readThemeColorByCSSVar().main);
  const [secondaryColor, setSecondaryColor] = useState(() => readThemeColorByCSSVar().secondary);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const { main: newMain, secondary: newSecondary } = readThemeColorByCSSVar();
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
