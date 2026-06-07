import { type FC, memo, useCallback, useMemo } from "react";
import { createPlayerPlaylistModal } from "@/wins/main/componets/player-playlist-modal";
import {
  ArrowRightLeft,
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  Repeat1,
  Repeat2,
  Shuffle,
  SkipBack,
  SkipForward
} from "lucide-react";

import Progress from "./progress";
import RendererPlayerHandle from "@/wins/main/lib/handle";
import AppModal from "@/common/components/display/modal";

const Control: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();
  const centerIcon = useMemo(() => {
    if (player.playing) {
      return (
        <Pause
          className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
          fill={"rgba(255,255,255,0.89)"}
          onClick={() => player.audio.pause()}
        />
      );
    } else if (player.loading) {
      return (
        <LoaderCircle
          className="animate-spin size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
          color={"rgba(255,255,255,0.89)"}
        />
      );
    }
    return (
      <Play
        className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
        fill={"rgba(255,255,255,0.89)"}
        onClick={() => player.audio.play()}
      />
    );
  }, [player.audio, player.loading, player.playing]);
  const { create } = AppModal.useModal();
  const openPlaylistModal = useCallback(() => {
    create(createPlayerPlaylistModal);
  }, [create]);
  return (
    <div className="space-x-2 w-full">
      <Progress />
      <div className="flex flex-row justify-center items-center gap-16 text-[rgba(255,255,255,0.89)] font-bold mt-2">
        <div className="flex justify-center items-center gap-8">
          <SkipBack
            className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            fill={"rgba(255,255,255,0.89)"}
            onClick={() => player.playlist.last(true)}
          />
          {centerIcon}
          <SkipForward
            className="size-5 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            fill={"rgba(255,255,255,0.89)"}
            onClick={() => player.playlist.next(true)}
          />
          {player.playlist.shuffle ? (
            <Shuffle
              className="size-6 scale-85 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={() => (player.playlist.shuffle = false)}
            />
          ) : (
            <ArrowRightLeft
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              fill={"rgba(255,255,255,0.89)"}
              onClick={() => (player.playlist.shuffle = true)}
            />
          )}
          {player.playlist.repeat !== "off" ? (
            <Repeat1
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              onClick={() => (player.playlist.repeat = "off")}
            />
          ) : (
            <Repeat2
              className="size-6 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
              onClick={() => (player.playlist.repeat = "one")}
            />
          )}
          <ListMusic
            className="size-6 scale-85 cursor-pointer hover:opacity-50 ease-in-out duration-300 transition-all active:scale-90"
            onClick={openPlaylistModal}
          />
        </div>
      </div>
    </div>
  );
};
export default memo(Control);
