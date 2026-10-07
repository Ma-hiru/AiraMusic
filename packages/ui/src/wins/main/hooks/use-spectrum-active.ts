import { useAtomValue } from "jotai";
import { useSettings } from "@/common/store/settings";
import { playModalAtom } from "@/wins/main/atoms/layout";

import { usePlayerViewVisible } from "./use-player-view-visible";

/** 分析和绘制共用同一个启用条件，未显示的页面不参与频谱更新 */
export function useSpectrumActive(isPlaying: boolean, view?: "bar" | "player") {
  const playModal = useAtomValue(playModalAtom);
  const { performance } = useSettings();
  const visible = usePlayerViewVisible(view);
  const enabled = playModal ? performance.playerSpectrum : performance.barSpectrum;
  return isPlaying && visible && enabled;
}
