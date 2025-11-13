import { FC, memo } from "react";
import { usePlayer } from "@mahiru/ui/ctx/PlayerCtx";

const Control: FC<object> = () => {
  const { play, mute, upVolume, downVolume } = usePlayer();
  return (
    <div className="space-x-2">
      <button onClick={play} className="px-2 py-1 rounded-lg bg-white/50">
        play
      </button>
      <button onClick={mute} className="px-2 py-1 rounded-lg bg-white/50">
        mute
      </button>
      <button onClick={() => upVolume(0.1)} className="px-2 py-1 rounded-lg bg-white/50">
        volume +
      </button>
      <button onClick={() => downVolume(0.1)} className="px-2 py-1 rounded-lg bg-white/50">
        volume -
      </button>
    </div>
  );
};
export default memo(Control);
