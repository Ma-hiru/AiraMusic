import { FC, memo, useMemo } from "react";
import {
  ArrowRightLeft,
  LoaderCircle,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward
} from "lucide-react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { PlayerFSMStatusEnum } from "@mahiru/ui/public/enum";

import Progress from "./Progress";

const Control: FC<object> = () => {
  const { PlayerCoreGetter, PlayerFSMStatus, PlayerStatus, PlayingRequest } = usePlayerStore([
    "PlayerCoreGetter",
    "PlayerFSMStatus",
    "PlayerStatus",
    "PlayingRequest"
  ]);
  const player = PlayerCoreGetter();
  const centerIcon = useMemo(() => {
    if (PlayerFSMStatus === PlayerFSMStatusEnum.playing) {
      return (
        <Pause
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
          fill={"rgba(255,255,255,0.89)"}
          onClick={player?.play}
        />
      );
    } else if (PlayerFSMStatus === PlayerFSMStatusEnum.loading) {
      return (
        <LoaderCircle
          className="animate-spin size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
          color={"rgba(255,255,255,0.89)"}
        />
      );
    } else if (PlayingRequest) {
      return (
        <Pause
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
          fill={"rgba(255,255,255,0.89)"}
          onClick={player?.play}
        />
      );
    }
    return (
      <Play
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        fill={"rgba(255,255,255,0.89)"}
        onClick={player?.play}
      />
    );
  }, [PlayerFSMStatus, PlayingRequest, player?.play]);

  return (
    <div className="space-x-2 w-full">
      <Progress />
      <div className="flex flex-row justify-center items-center gap-16 text-[rgba(255,255,255,0.89)] font-bold mt-2">
        <div className="flex justify-center items-center gap-8">
          <SkipBack
            className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            fill={"rgba(255,255,255,0.89)"}
            onClick={() => player?.last(true)}
          />
          {centerIcon}
          <SkipForward
            className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            fill={"rgba(255,255,255,0.89)"}
            onClick={() => player?.next(true)}
          />
          {PlayerStatus.shuffle ? (
            <Shuffle
              className="size-6 scale-85 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={() => player && (player.shuffle = false)}
            />
          ) : (
            <ArrowRightLeft
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={() => player && (player.shuffle = true)}
            />
          )}
          {PlayerStatus.repeat !== "off" ? (
            <Repeat1
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              onClick={() => player && (player.repeat = "off")}
            />
          ) : (
            <Repeat2
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              onClick={() => player && (player.repeat = "one")}
            />
          )}
        </div>
      </div>
    </div>
  );
};
export default memo(Control);
