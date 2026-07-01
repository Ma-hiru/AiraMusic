import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, type FC, useEffect, useCallback, type WheelEvent } from "react";
import { Trash2, Volume, Volume1, Volume2, VolumeX, ListMusic } from "lucide-react";
import { RendererWindow } from "@/common/lib/window";
import { fmModeAtom } from "@/wins/main/atoms/track";
import { useUpdate } from "@/common/hooks/use-update";
import { NeteaseAPITrack } from "@/common/netease/api";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useListenable } from "@/common/hooks/use-listenable";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { usePlayerActionInList } from "@/wins/main/hooks/use-player-action-in-list";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import Tooltip from "@/common/components/display/tooltip";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import RangeSlider from "@/common/components/data-input/range";

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
  const { create, createPlayerPlaylistModal } = AppModal.useModal();
  const lyricWindow = useListenable(RendererWindow.get("lyric"));
  const player = RendererPlayerHandle.usePlayer();
  const muted = player.audio.instance.muted;
  const volume = muted ? 0 : player.audio.volume;
  const volumePercent = Math.round(volume * 100);
  const VolumeTag = getVolumeIcon(volume);
  const fmMode = useAtomValue(fmModeAtom);

  const update = useUpdate();
  const actionRef = useLatestRef({
    ...usePageJump(),
    ...usePlayerActionInList(() => player.playlist.list())
  });
  const openPlaylistModal = useCallback(() => {
    create(createPlayerPlaylistModal, actionRef.current);
  }, [actionRef, create, createPlayerPlaylistModal]);

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

      <Tooltip
        className="size-5 items-center justify-center"
        placement="top"
        tooltipLabel="音量调整"
        tooltipRole="group"
        onWheel={onWheel}
        content={
          <div
            className="
              border border-white/30
              flex h-36 w-8 flex-col items-center gap-3 rounded-md
              bg-(--text-color)/80 px-0 py-3 text-primary
              backdrop-saturate-150 backdrop-blur-lg
            ">
            <p className="text-[10px] font-semibold text-primary">{volumePercent}%</p>
            <RangeSlider
              className="h-24"
              min={0}
              step={1}
              max={100}
              label="音量"
              value={volumePercent}
              orientation="vertical"
              valueText={`${volumePercent}%`}
              onChange={onVolumeChange}
            />
          </div>
        }
        interactive>
        <button
          className="
            size-5 flex items-center justify-center select-none cursor-pointer
            hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
          "
          type="button"
          aria-label={volumePercent <= 0 ? "已静音" : `音量 ${volumePercent}%`}
          onClick={toggleMute}>
          <VolumeTag className="size-5" aria-hidden="true" fill="currentColor" />
        </button>
      </Tooltip>
      <button
        className="
          size-5 flex items-center justify-center select-none cursor-pointer
          hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90
        "
        title="播放列表"
        type="button"
        onClick={openPlaylistModal}>
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
