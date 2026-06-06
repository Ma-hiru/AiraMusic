import { cx } from "@emotion/css";
import { type FC, memo, useCallback, useEffect, type WheelEvent } from "react";
import { ListMusic, Volume, Volume1, Volume2, VolumeX } from "lucide-react";
import { useThemeColor } from "@/common/hooks/use-theme-color";
import { useUpdate } from "@/common/hooks/use-update";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { createPlayerPlaylistModal } from "@/wins/main/componets/player-playlist-modal";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppModal from "@/common/components/modal";
import Tooltip from "@/common/components/tooltip";
import RangeSlider from "@/common/components/range";

const WHEEL_VOLUME_STEP = 0.1;
const RESTORE_VOLUME = 0.5;
const player = RendererPlayerHandle.player;

const getVolumeIcon = (volume: number) => {
  if (volume <= 0) {
    return VolumeX;
  } else if (volume <= 0.15) {
    return Volume;
  } else if (volume <= 0.5) {
    return Volume1;
  }
  return Volume2;
};
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
  const { textColorOnMain } = useThemeColor();
  const { create } = AppModal.useModal();
  const lyricWindow = useListenable(RendererWindow.get("lyric"));
  const player = RendererPlayerHandle.usePlayer();
  const iconColor = textColorOnMain.hex();
  const muted = player.audio.instance.muted;
  const volume = muted ? 0 : player.audio.volume;
  const volumePercent = Math.round(volume * 100);
  const VolumeTag = getVolumeIcon(volume);
  const update = useUpdate();

  const openPlaylistModal = useCallback(() => {
    create(createPlayerPlaylistModal);
  }, [create]);

  const openLyricWindow = useCallback(async () => {
    if (lyricWindow.opened) {
      lyricWindow.close();
    } else {
      await lyricWindow.reactReadyAwait();
      RendererPlayerHandle.busUpdater?.();
    }
  }, [lyricWindow]);

  useEffect(() => {
    player.audio.addEventListener("volumechange", update, { passive: true });
    return () => {
      player.audio.removeEventListener("volumechange", update);
    };
  }, [player.audio, update]);

  return (
    <div className="flex gap-4 justify-end items-center h-full ">
      <Tooltip
        interactive
        tooltipRole="group"
        tooltipLabel="音量调整"
        placement="top"
        onWheel={onWheel}
        className="size-5 items-center justify-center"
        content={
          <div
            className="
              flex h-36 w-8 flex-col items-center gap-3 rounded-md border border-white/30
              bg-white px-0 py-3 text-(--theme-color-main)
              shadow-[0_16px_30px_-18px_rgba(0,0,0,0.45)] backdrop-blur-2xl
            ">
            <p className="text-[10px] font-black text-(--theme-color-main)">{volumePercent}%</p>
            <RangeSlider
              min={0}
              max={100}
              step={1}
              value={volumePercent}
              onChange={onVolumeChange}
              orientation="vertical"
              className="h-24"
            />
          </div>
        }>
        <button
          type="button"
          aria-label={volumePercent <= 0 ? "已静音" : `音量 ${volumePercent}%`}
          onClick={toggleMute}
          className="
            size-5 flex items-center justify-center select-none cursor-pointer
            hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
          ">
          <VolumeTag aria-hidden="true" color={iconColor} fill={iconColor} className="size-5" />
        </button>
      </Tooltip>
      <button
        title="播放列表"
        type="button"
        onClick={openPlaylistModal}
        className="
          size-5 flex items-center justify-center select-none cursor-pointer
          hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
          text-(--text-color-on-main)
        ">
        <ListMusic className="size-5" />
      </button>
      <button
        title="桌面歌词"
        type="button"
        className={cx(
          `
          size-5 flex justify-center items-center font-semibold
          hover:opacity-50 select-none cursor-pointer
          ease-in-out duration-300 transition-all
          active:scale-90
          `,
          lyricWindow.opened ? "text-(--theme-color-main)" : "text-(--text-color-on-main)"
        )}
        onClick={openLyricWindow}>
        词
      </button>
    </div>
  );
};
export default memo(BarBtns);
