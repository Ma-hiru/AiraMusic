import { memo } from "react";
import { useSettings } from "@/common/store/settings";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const Background = () => {
  const themeBus = useThemeInjectFromBus();
  const settings = useSettings();

  return (
    <div className="fixed inset-0 z-[-1]">
      <AcrylicBackground
        blur={60}
        saturate={3}
        opacity={0.6}
        brightness={0.3}
        src={themeBus.data?.backgroundCover}
        fluid={settings.performance.useHomeFluid}
        themeColors={themeBus.data?.theme.themeColors}
        fluidSpeed={settings.performance.homeFluidSpeed}
        fluidPaused
      />
    </div>
  );
};

export default memo(Background);
