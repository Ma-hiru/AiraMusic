import { memo, type FC } from "react";
import { useSettings } from "@/common/store/settings";
import { NeteaseSettings } from "@/common/netease/models";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AcrylicBackground from "@/common/components/display/acrylic-background";
import type { ResourceBackdrop } from "@/common/hooks/use-resource-page-theme";

const Background: FC<{ resource?: ResourceBackdrop }> = ({ resource }) => {
  const themeBus = useThemeInjectFromBus();
  const settings = useSettings();

  return (
    <div className="fixed inset-0 z-[-1]">
      <AcrylicBackground
        blur={60}
        saturate={3}
        opacity={0.6}
        brightness={0.3}
        fluid={settings.performance.useHomeFluid}
        src={resource ? resource.src : themeBus.data?.backgroundCover}
        fluidMode={settings.performance.forceCssFluid ? "css" : "shader"}
        themeColors={resource ? resource.themeColors : themeBus.data?.theme.themeColors}
        fluidSpeed={NeteaseSettings.fluidSpeedMultiplier(settings.performance.homeFluidSpeed)}
        fluidPaused
      />
    </div>
  );
};

export default memo(Background);
