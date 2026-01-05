import { useEffect, useState } from "react";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { debounce } from "lodash-es";

export function useThemeSyncReceive() {
  const [themeSync, setThemeSync] = useState<ThemeSync>({
    secondaryColor: "#ffffff",
    mainColor: "#fc3d49",
    KMeansColor: ["#fc3d49", "#ffffff"],
    textColorOnMain: "#000000",
    backgroundImage: undefined
  });

  useEffect(() => {
    return Renderer.addMessageHandler("themeSync", "main", setThemeSync);
  }, []);

  return { themeSync, requestThemeSync };
}

const requestThemeSync = debounce(() => {
  Renderer.sendMessage("requestThemeSync", "main", undefined);
}, 500);
