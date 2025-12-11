import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";
import Progress from "./Progress";
import {
  ArrowRightLeft,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward
} from "lucide-react";

const Control: FC<object> = () => {
  const { audioControl, playerStatus, playlistControl } = usePlayer();
  return (
    <div className="space-x-2 w-full">
      <Progress />
      <div className="flex flex-row justify-center items-center gap-16 text-[rgba(255,255,255,0.89)] font-bold mt-2">
        <div className="flex justify-center items-center gap-8">
          <SkipBack
            className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            fill={"rgba(255,255,255,0.89)"}
            onClick={() => playlistControl.lastTrack(true)}
          />
          {playerStatus.playing ? (
            <Pause
              className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={audioControl.play}
            />
          ) : (
            <Play
              className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={audioControl.play}
            />
          )}
          <SkipForward
            className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            fill={"rgba(255,255,255,0.89)"}
            onClick={() => playlistControl.nextTrack(true)}
          />
          {playerStatus.shuffle ? (
            <Shuffle
              className="size-6 scale-85 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={() => playlistControl.setShuffle(false)}
            />
          ) : (
            <ArrowRightLeft
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={() => playlistControl.setShuffle(true)}
            />
          )}
          {playerStatus.repeat !== "off" ? (
            <Repeat1
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              onClick={() => playlistControl.setRepeat("off")}
            />
          ) : (
            <Repeat2
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              onClick={() => playlistControl.setRepeat("one")}
            />
          )}
        </div>
      </div>
    </div>
  );
};
export default memo(Control);
