import { FC, memo, ReactNode, useEffect, useState } from "react";
import AppEntry from "@mahiru/ui/windows/main/entry";
import AppAudio from "@mahiru/ui/public/player/audio";

interface ProgressProps {
  render: (progress: InstanceType<typeof AppAudio>["progress"]) => ReactNode;
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
