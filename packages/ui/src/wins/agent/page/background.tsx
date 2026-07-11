import { memo } from "react";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const Background = () => {
  const themeBus = useThemeInjectFromBus();

  return (
    <div className="fixed inset-0 z-[-1]">
      <AcrylicBackground
        blur={60}
        saturate={3}
        opacity={0.6}
        brightness={0.3}
        src={themeBus.data?.backgroundCover}
        themeColors={themeBus.data?.theme.themeColors}
      />
    </div>
  );
};

export default memo(Background);
