import { useSyncExternalStore } from "react";
import { UI } from "@mahiru/ui/utils/ui";

export function useThemeColor() {
  return useSyncExternalStore(
    (updater) => {
      const observer = new MutationObserver(updater);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["style"]
      });
      return () => observer.disconnect();
    },
    () => ({
      mainColor: UI.APPThemeColorInstance.main,
      secondaryColor: UI.APPThemeColorInstance.secondary,
      textColorOnMain: UI.Utils.calcTextColorOn(UI.APPThemeColor.main)
    })
  );
}
