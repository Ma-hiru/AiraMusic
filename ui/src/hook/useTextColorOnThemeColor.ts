import { getTextColorByBackgroundColor, readThemeColorByCSSVar } from "@mahiru/ui/utils/ui";
import { useEffect, useState } from "react";

export function useTextColorOnThemeColor() {
  const [mainColor, setMainColor] = useState(() => readThemeColorByCSSVar().main);
  const [textColor, setTextColor] = useState(() => getTextColorByBackgroundColor(mainColor).hex());

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const { main: newMain } = readThemeColorByCSSVar();
      if (mainColor !== newMain) {
        setMainColor(newMain);
      }
      const newTextColor = getTextColorByBackgroundColor(newMain).hex();
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
    getTextColorByBackgroundColor(mainColor).hex();
  }, [mainColor]);

  return textColor;
}
