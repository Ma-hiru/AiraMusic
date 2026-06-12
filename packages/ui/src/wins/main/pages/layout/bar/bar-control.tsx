import { type FC, memo, useMemo } from "react";
import { LoaderCircle, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import RendererPlayerHandle from "@/wins/main/lib/handle";

const BarControl: FC<object> = () => {
  const player = RendererPlayerHandle.usePlayer();

  const centerIcon = useMemo(() => {
    if (player.playing) {
      return <Pause className="size-5" fill="currentColor" />;
    } else if (player.loading) {
      return <LoaderCircle className="size-5 animate-spin" />;
    }
    return <Play className="size-5" fill="currentColor" />;
  }, [player.loading, player.playing]);

  return (
    <div className="flex justify-center items-center gap-6">
      <SkipBack
        className="hover:opacity-60 active:scale-90 cursor-pointer ease-in-out transition-all duration-300 size-5"
        fill="currentColor"
        onClick={() => player.playlist.last(true)}
      />
      <div
        className="hover:opacity-60 active:scale-90 cursor-pointer ease-in-out transition-all duration-300 text-(--theme-color-main) bg-(--text-color-on-main) p-2 rounded-full"
        onClick={player.playing ? () => player.audio.pause() : () => player.audio.play()}>
        {centerIcon}
      </div>
      <SkipForward
        className="hover:opacity-60 active:scale-90 cursor-pointer ease-in-out transition-all duration-300 size-5"
        fill="currentColor"
        onClick={() => player.playlist.next(true)}
      />
    </div>
  );
};
export default memo(BarControl);
