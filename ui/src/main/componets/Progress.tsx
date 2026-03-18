import { FC, memo, ReactNode, useEffect, useState } from "react";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";
import AppInstance from "@mahiru/ui/main/entry/instance";

interface ProgressProps {
  render: (progress: PlayerProgress) => ReactNode;
}

const Progress: FC<ProgressProps> = ({ render }) => {
  const player = AppInstance.usePlayer();
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
