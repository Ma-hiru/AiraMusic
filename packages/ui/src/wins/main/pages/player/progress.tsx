import { type FC, Fragment, memo, useCallback } from "react";
import { motion } from "motion/react";
import { css } from "@emotion/css";
import { usePlayProgress } from "@/wins/main/hooks/use-play-progress";
import { RendererFormat } from "@/common/lib/format";
import { useProgress } from "@/wins/main/hooks/use-progress";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useSetAtom } from "jotai";
import { playModalAtom } from "@/wins/main/atoms/layout";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import Marquee from "@/common/components/display/marquee";

const Progress: FC<object> = () => {
  const { barRef, bufferScope, percentScope, handleBarClick, handleBarMouseDown, chorusPercent } =
    usePlayProgress();
  const { progress } = useProgress();
  const player = RendererPlayerHandle.usePlayer();
  const track = player.current.track?.detail;

  const setPlayModal = useSetAtom(playModalAtom);
  const { jumpArtistPage } = usePageJump();

  const jump = useCallback(
    (id: number) => {
      void jumpArtistPage(id);
      setPlayModal(false);
    },
    [jumpArtistPage, setPlayModal]
  );

  return (
    <div className="w-full contain-layout">
      <div className="h-3 flex flex-col justify-center">
        <div
          ref={barRef}
          onClick={handleBarClick}
          onMouseDown={handleBarMouseDown}
          className="relative h-2 overflow-hidden cursor-pointer ease-in-out transition-all duration-300 rounded-full bg-white/10 backdrop-blur-lg hover:h-3 ">
          <motion.span
            ref={percentScope}
            initial={{ width: 0 }}
            className="absolute left-0 top-0 block h-full bg-white/50 backdrop-blur-lg rounded-full"
          />
          {/*缓冲区*/}
          <motion.span
            ref={bufferScope}
            initial={{ width: 0 }}
            className="block h-full bg-white/30 backdrop-blur-lg rounded-full"
          />
          {chorusPercent.map((percent, index) => {
            return (
              <span
                key={index}
                className={css`
                  position: absolute;
                  top: 0;
                  left: ${percent}%;
                  height: 100%;
                  width: 3px;
                `}
                style={{ background: "white" }}
              />
            );
          })}
        </div>
      </div>
      <div className="w-full flex justify-between items-center backdrop-blur-lg text-[12px] mt-1">
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
              <Fragment key={a.id}>
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
