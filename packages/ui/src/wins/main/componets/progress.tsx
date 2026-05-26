import { type FC, memo, type ReactNode, useEffect, useState } from "react";
import AppEntry from "@/wins/main/entry";
import RendererPlayerAudio from "@/common/player/audio";

interface ProgressProps {
  render: (progress: InstanceType<typeof RendererPlayerAudio>["progress"]) => ReactNode;
}

const Progress: FC<ProgressProps> = ({ render }) => {
  const player = AppEntry.usePlayer();
  const [data, setData] = useState<Nullable<ReactNode>>(null);

  useEffect(() => {
    const update = () => {
      setData(render(player.audio.progress));
    };
    player.audio.addEventListener("timeupdate", update, { passive: true });
    return () => {
      player.audio.removeEventListener("timeupdate", update);
    };
  }, [player.audio, render]);

  return data;
};
export default memo(Progress);
