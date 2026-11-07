import { cx } from "@emotion/css";
import { useAtom, useSetAtom, useAtomValue } from "jotai";
import { Trash2, ListMusic, HeartPulse } from "lucide-react";
import { memo, type FC, useEffect, useCallback, startTransition, type WheelEvent } from "react";
import { RendererWindow } from "@/common/lib/window";
import { useUpdate } from "@/common/hooks/use-update";
import { NeteaseAPITrack } from "@/common/netease/api";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenable } from "@/common/hooks/use-listenable";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { openPlayListDisplay } from "@/wins/main/lib/open-play-list-display";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import { fmModeAtom, intelligenceModeAtom, intelligenceSessionAtom } from "@/wins/main/atoms/track";
import AppToast from "@/common/components/display/toast";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import VolumeControl from "@/common/components/data-input/volume-control";
import AppDrawer, {
  type PlaylistDrawerProps,
  createPlayerPlaylistDrawer
} from "@/common/components/display/drawer";

const WHEEL_VOLUME_STEP = 0.1;
const RESTORE_VOLUME = 0.5;
const player = RendererPlayerHandle.player;

const onVolumeChange = (value: number) => {
  player.audio.volume = value / 100;
};
const toggleMute = () => {
  if (player.audio.instance.muted || player.audio.volume <= 0) {
    if (player.audio.volume <= 0) {
      player.audio.volume = RESTORE_VOLUME;
    } else {
      player.audio.unmute();
    }
    return;
  }
  player.audio.mute();
};
const onWheel = (e: WheelEvent<HTMLElement>) => {
  // 向上滚增加音量，向下滚减少音量
  const delta = e.deltaY < 0 ? WHEEL_VOLUME_STEP : -WHEEL_VOLUME_STEP;
  player.audio.volume = Number((player.audio.volume + delta).toFixed(2));
};

const BarBtns: FC<object> = () => {
  const { create } = AppDrawer.useDrawer();
  const lyricWindow = useListenable(RendererWindow.get("lyric"));
  const player = RendererPlayerHandle.usePlayer();
  const muted = player.audio.instance.muted;
  const volume = muted ? 0 : player.audio.volume;
  const volumePercent = Math.round(volume * 100);
  const fmMode = useAtomValue(fmModeAtom);
  const setPlayModal = useSetAtom(playModalAtom);
  const setIntelligenceSession = useSetAtom(intelligenceSessionAtom);
  const [intelligenceMode, setIntelligenceMode] = useAtom(intelligenceModeAtom);

  const update = useUpdate();
  const actionRef = useLatestRef<PlaylistDrawerProps>({
    ...usePageJump(),
    ...usePlayerActionInList(() => player.playlist.list(), player.playlist.mark_id),
    onPageAction: openPlayListDisplay
  });
  const openPlaylistDrawer = useCallback(() => {
    create(createPlayerPlaylistDrawer, actionRef.current);
  }, [actionRef, create]);

  const openLyricWindow = useCallback(async () => {
    if (lyricWindow.opened) {
      lyricWindow.close();
    } else {
      await lyricWindow.reactReadyAwait();
    }
  }, [lyricWindow]);

  useEffect(() => {
    player.audio.addEventListener("volumechange", update, { passive: true });
    return () => {
      player.audio.removeEventListener("volumechange", update);
    };
  }, [player.audio, update]);

  const dislike = useCallback(() => {
    const current = player.current.track;
    if (!current || !fmMode) return;
    void NeteaseAPITrack.personalFMTrash(current.id);
    player.playlist.remove(current);
    AppToast.show({
      type: "success",
      text: `已移除 ${current.name}`
    });
  }, [fmMode, player]);

  const enableHeart = useCallback(() => {
    startTransition(() => {
      setIntelligenceMode(true);
      setPlayModal(true);
      setIntelligenceSession((s) => s + 1);
    });
  }, [setIntelligenceMode, setIntelligenceSession, setPlayModal]);

  const disableHeart = useCallback(() => {
    startTransition(() => {
      setIntelligenceMode(false);
    });
  }, [setIntelligenceMode]);

  return (
    <div className="flex gap-4 justify-end items-center h-full ">
      {fmMode && (
        <button
          className="
            size-5 flex items-center justify-center select-none cursor-pointer
            hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
          "
          title="不再推荐"
          type="button"
          onClick={dislike}>
          <Trash2 className="size-5" />
        </button>
      )}
      <button
        className="
            size-4.5 flex items-center justify-center select-none cursor-pointer
            hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
          "
        type="button"
        title={intelligenceMode ? "关闭心动模式" : "打开心动模式"}
        onClick={intelligenceMode ? disableHeart : enableHeart}>
        <HeartPulse className="size-5" fill={intelligenceMode ? "currentColor" : "none"} />
      </button>
      <VolumeControl
        value={volumePercent}
        muted={muted || volumePercent <= 0}
        onWheel={onWheel}
        onChange={onVolumeChange}
        onToggleMute={toggleMute}
      />
      <button
        className="
          size-5 flex items-center justify-center select-none cursor-pointer
          hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
        "
        title="播放列表"
        type="button"
        onClick={openPlaylistDrawer}>
        <ListMusic className="size-5" />
      </button>
      <button
        className={cx(
          `
          size-5 flex justify-center items-center font-semibold
          hover:opacity-50 select-none cursor-pointer
          ease-in-out duration-300 transition-all
          active:scale-90
          `,
          lyricWindow.opened && "text-primary"
        )}
        title="桌面歌词"
        type="button"
        onClick={openLyricWindow}>
        词
      </button>
    </div>
  );
};
export default memo(BarBtns);
