import { FC, memo, useEffect } from "react";
import { useLayoutStatus } from "@mahiru/ui/store";
import { useKmeansWorker } from "@mahiru/ui/hook/useKmeansWorker";
import { Renderer } from "@mahiru/ui/utils/renderer";
import { useThemeColor } from "@mahiru/ui/hook/useThemeColor";

const ThemeColor: FC<object> = () => {
  const { background } = useLayoutStatus(["background"]);
  const { mainColor, secondaryColor, textColorOnMain } = useThemeColor();

  useKmeansWorker(background);
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
            backgroundImage: background
          }
        });
      });
    });
    return () => {
      canceled = true;
    };
  }, [background, mainColor, secondaryColor, textColorOnMain]);

  return null;
};
export default memo(ThemeColor);
