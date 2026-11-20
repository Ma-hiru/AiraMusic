import { useSetAtom } from "jotai";
import { memo, type FC, Fragment, useCallback } from "react";
import { RendererFormat } from "@/common/lib/format";
import { useSettings } from "@/common/store/settings";
import { NeteaseArtist } from "@/common/netease/models";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useProgress } from "@/wins/main/hooks/use-progress";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { usePlayProgress } from "@/wins/main/hooks/use-play-progress";
import Marquee from "@/common/components/display/marquee";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import WavePlayerProgress from "@/common/components/display/player-progress/wave";
import NormalPlayerProgress from "@/common/components/display/player-progress/normal";

const Progress: FC<object> = () => {
  const { progress } = useProgress("player");
  const settings = useSettings();
  const player = RendererPlayerHandle.usePlayer();
  const waveProgress = settings.preference.useWavePlayerProgress;
  const { onUpdate, track, visible, progressRef } = usePlayProgress(
    "player",
    waveProgress ? "wave" : "normal"
  );

  const setPlayModal = useSetAtom(playModalAtom);
  const { jumpArtistPage } = usePageJump();

  const jump = useCallback(
    (id: number) => {
      void jumpArtistPage(id);
      !settings.preference.defaultUseDisplayWindow && setPlayModal(false);
    },
    [jumpArtistPage, setPlayModal, settings.preference.defaultUseDisplayWindow]
  );

  return (
    <div className="w-full contain-layout">
      <div className="h-3 flex flex-col justify-center">
        {waveProgress ? (
          <WavePlayerProgress
            ref={progressRef}
            style={{ width: "100%", height: "100%" }}
            track={track}
            visible={visible}
            playing={player.playing}
            onUpdate={onUpdate}
          />
        ) : (
          <NormalPlayerProgress ref={progressRef} track={track} onUpdate={onUpdate} />
        )}
      </div>
      <div className="w-full flex justify-between items-center backdrop-blur-lg text-[12px] mt-1 gap-2">
        <Marquee
          className="flex-1 flex gap-1 items-center"
          options={{
            speed: 20,
            pingPong: true,
            pauseOnHover: true,
            gapDuration: 2000
          }}>
          {track?.ar?.map((a, index) => {
            return (
              <Fragment key={NeteaseArtist.computedKey(a, index)}>
                <a
                  className="hover:opacity-50 cursor-pointer active:scale-98 ease-in-out duration-300 transition-all truncate"
                  onClick={() => jump(a.id)}>
                  {a.name}
                </a>
                {index < track?.ar.length - 1 && (
                  <span className="opacity-80 font-medium mx-0.5">/</span>
                )}
              </Fragment>
            );
          })}
        </Marquee>
        <div className="flex justify-end items-center">
          <span>{RendererFormat.duration(progress.currentTime, "s")}</span>
          <span className="opacity-50 mx-0.5">/</span>
          <span>{RendererFormat.duration(progress.duration, "s")}</span>
        </div>
      </div>
    </div>
  );
};

export default memo(Progress);
