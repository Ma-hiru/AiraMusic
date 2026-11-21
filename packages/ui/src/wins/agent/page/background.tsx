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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,color-mix(in_srgb,var(--m3-on-surface)_5.5%,transparent),transparent_34%),linear-gradient(145deg,color-mix(in_srgb,var(--m3-surface)_34%,transparent),color-mix(in_srgb,var(--m3-surface)_58%,transparent))]" />
    </div>
  );
};

export default memo(Background);
