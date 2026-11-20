import { memo, useRef, type FC, useEffect, useCallback } from "react";
import { RendererFormat } from "@/common/lib/format";
import { useSettings } from "@/common/store/settings";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import NoDrag from "@/common/components/layout/drag/no-drag";
import WavePlayerProgress from "@/common/components/display/player-progress/wave";
import NormalPlayerProgress from "@/common/components/display/player-progress/normal";
import type { PlayerProgressRef } from "@/common/hooks/use-progress-sync";

const MiniProgress: FC<{
  color: string;
  playing: boolean;
  visible: boolean;
  track: Optional<NeteaseTrackModel>;
}> = ({ color, track, playing, visible }) => {
  const wave = useSettings().preference.useWaveMiniPlayerProgress;
  const progressRef = useRef<PlayerProgressRef>(null);
  const bus = useListenable(RendererIPCMessageBus.progress, !visible);
  const trackID = track?.id;
  const progress = trackID && bus.data?.trackID === trackID ? bus.data : null;
  const seekable = !!progress && Number.isFinite(progress.duration) && progress.duration > 0;

  useEffect(() => {
    if (!visible) return;
    const tick = progressRef.current?.tick;
    if (!tick) return;

    const sync = (force = false) => {
      const progress = bus.data;
      if (!trackID || progress?.trackID !== trackID || !(progress.duration > 0)) {
        tick(true, { percent: 0, buffer: 0 });
        return;
      }
      tick(force || !!progress.immediate, {
        percent: (progress.currentTime / progress.duration) * 100,
        buffer: (progress.buffered / progress.duration) * 100
      });
    };
    sync(true);
    const unsubscribe = bus.addListener(() => sync());
    return () => {
      unsubscribe();
      tick.cancel();
    };
  }, [bus, trackID, visible, wave]);

  const seek = useCallback(
    (percent: number) => {
      if (!trackID || bus.data?.trackID !== trackID || !(bus.data.duration > 0)) return;
      RendererIPCMessageBus.playerAction.deliver({ type: "seek", trackID, percent });
    },
    [bus, trackID]
  );

  return (
    <NoDrag className="flex min-w-0 items-center gap-2 whitespace-nowrap text-[10px] leading-3 tabular-nums">
      <span className="min-w-7 opacity-80">
        {RendererFormat.duration(progress?.currentTime, "s")}
      </span>
      <div className="flex h-3 min-w-0 flex-1 touch-none flex-col justify-center" inert={!seekable}>
        {wave ? (
          <WavePlayerProgress
            ref={progressRef}
            style={{ width: "100%", height: "100%" }}
            color={color}
            track={track}
            playing={playing}
            visible={visible}
            thumbColor={color}
            onUpdate={seek}
          />
        ) : (
          <NormalPlayerProgress
            ref={progressRef}
            track={track}
            chorusClassName="bg-current!"
            bufferClassName="bg-current/35! backdrop-blur-none!"
            percentClassName="bg-current/85! backdrop-blur-none!"
            containerClassName="h-1! touch-none bg-current/20! backdrop-blur-none! hover:h-1.5!"
            onUpdate={seek}
          />
        )}
      </div>
      <span className="min-w-7 text-right opacity-80">
        {RendererFormat.duration(progress?.duration, "s")}
      </span>
    </NoDrag>
  );
};

export default memo(MiniProgress);
