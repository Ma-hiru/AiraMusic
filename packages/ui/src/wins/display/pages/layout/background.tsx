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
        fluidPaused
        src={themeBus.data?.backgroundCover}
        fluid={settings.performance.useHomeFluid}
        fluidSpeed={settings.performance.homeFluidSpeed}
        themeColors={themeBus.data?.theme.themeColors}
        opacity={0.6}
        brightness={0.3}
        saturate={3}
        blur={60}
      />
    </div>
  );
};

export default memo(Background);
