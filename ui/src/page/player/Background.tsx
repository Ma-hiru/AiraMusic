import { FC, memo } from "react";
import BackgroundRender from "@mahiru/ui/componets/player/BackgroundRender";
import { useFileCache } from "@mahiru/ui/hook/useFileCache";
import { useGPU } from "@mahiru/ui/hook/useGPU";
import { Filter, ImageSize } from "@mahiru/ui/utils/filter";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import { Lyric } from "@mahiru/ui/utils/lyric";
import { useLayoutStatus, usePlayerStatus } from "@mahiru/ui/store";

const Background: FC<object> = () => {
  const { trackStatus } = usePlayerStatus(["trackStatus"]);
  // const { playerStatus } = usePlayerStatus(["playerStatus"]);
  const { playerModalVisible } = useLayoutStatus(["playerModalVisible"]);
  const { hasRaw } = Lyric.getLyricVersionInfo(trackStatus?.lyric);
  const { hasDedicatedGPU } = useGPU();
  // const { spectrumData, isReady } = useSpectrum();
  // const [lowFreqVolume, setLowFreqVolume] = useState(1);

  const track = trackStatus?.track;
  const cachedBackground = useFileCache(Filter.NeteaseImageSize(track?.al.picUrl, ImageSize.lg));
  // const computedLowFreqVolume = useMemo(
  //   () => (Number.isFinite(lowFreqVolume) ? lowFreqVolume : 1),
  //   [lowFreqVolume]
  // );

  // useEffect(() => {
  //   if (!hasDedicatedGPU) return;
  //   let raf = 0;
  //   const tick = () => {
  //     const target = spectrumData.current?.lowFreqVolume;
  //     if (typeof target === "number" && Number.isFinite(target)) {
  //       setLowFreqVolume((prev) => prev + (target - prev) * 0.2);
  //     }
  //     raf = requestAnimationFrame(tick);
  //   };
  //
  //   if (isReady && playerStatus.playing) {
  //     raf = requestAnimationFrame(tick);
  //   }
  //
  //   return () => cancelAnimationFrame(raf);
  // }, [hasDedicatedGPU, isReady, playerStatus.playing, spectrumData]);

  return hasDedicatedGPU ? (
    <BackgroundRender
      className="absolute inset-0"
      albumIsVideo={false}
      playing={playerModalVisible}
      hasLyric={hasRaw}
      album={cachedBackground}
      staticMode={!playerModalVisible}
    />
  ) : (
    <AcrylicBackground
      className="absolute inset-0"
      src={cachedBackground}
      brightness={0.5}
      opacity={0.5}
    />
  );
};
export default memo(Background);
