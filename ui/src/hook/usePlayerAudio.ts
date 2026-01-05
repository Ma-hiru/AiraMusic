import { usePlayerStore } from "@mahiru/ui/store/player";

/**
 * 音频控制
 * - 监听zustand的audioRef变化，绑定audio元素的各种事件，更新播放进度、播放状态、音量等信息到zustand
 * - 提供播放/暂停、静音/取消静音、音量调节、跳转播放时间等方法
 * */
export function usePlayerAudio() {
  const {
    AudioRefGetter,
    PlayerInitialized,
    PlayerProgressGetter,
    PlayerFSMStatus,
    PlayerCoreGetter,
    SetPlayerStatus
  } = usePlayerStore([
    "AudioRefGetter",
    "PlayerInitialized",
    "PlayerProgressGetter",
    "PlayerFSMStatus",
    "PlayerCoreGetter",
    "SetPlayerStatus"
  ]);
}
