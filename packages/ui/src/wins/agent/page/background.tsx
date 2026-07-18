import { memo } from "react";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import AcrylicBackground from "@/common/components/display/acrylic-background";

const Background = () => {
  const themeBus = useThemeInjectFromBus();

  return (
    <div className="fixed inset-0 z-[-1]">
      <AcrylicBackground
        blur={72}
        opacity={0.52}
        saturate={1.28}
        brightness={0.32}
        gradient_alpha={0.28}
        src={themeBus.data?.backgroundCover}
        themeColors={themeBus.data?.theme.themeColors}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(255,255,255,0.055),transparent_34%),linear-gradient(145deg,rgba(5,7,11,0.34),rgba(5,7,11,0.58))]" />
    </div>
  );
};

export default memo(Background);
