import { FC, memo, useEffect } from "react";
import { useKmeansWorker } from "@mahiru/ui/hook/useKmeansWorker";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";
import { useLayoutStore } from "@mahiru/ui/store/layout";

const ThemeColor: FC<object> = () => {
  const { PlayerTheme } = useLayoutStore(["PlayerTheme"]);
  const { mainColor, secondaryColor, textColorOnMain } = useThemeColor();

  useKmeansWorker(PlayerTheme.BackgroundCover);
  useEffect(() => {
    let canceled = false;
    requestIdleCallback(() => {
      Renderer.invoke.hasOpenInternalWindow("info").then((ok) => {
        if (!ok || canceled) return;
        Renderer.sendMessage("infoSync", "info", {
          type: "theme",
          value: {
            mainColor: mainColor.string(),
            secondaryColor: secondaryColor.string(),
            textColor: textColorOnMain.string(),
            backgroundImage: PlayerTheme.BackgroundCover
          }
        });
      });
    });
    return () => {
      canceled = true;
    };
  }, [PlayerTheme.BackgroundCover, mainColor, secondaryColor, textColorOnMain]);

  return null;
};
export default memo(ThemeColor);
