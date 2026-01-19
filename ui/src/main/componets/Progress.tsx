import { FC, memo, ReactNode, useEffect } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";

interface ProgressProps {
  render: (progress: PlayerProgress) => ReactNode;
}

const Progress: FC<ProgressProps> = ({ render }) => {
  const { PlayerProgressGetter, PlayerCoreGetter } = usePlayerStore([
    "PlayerProgressGetter",
    "PlayerCoreGetter"
  ]);
  const progress = PlayerProgressGetter();
  const player = PlayerCoreGetter();
  const update = useUpdate();

  useEffect(() => {
    player.addEventListener("timeupdate", update);
    return () => {
      player.removeEventListener("timeupdate", update);
    };
  }, [player, update]);

  return <>{render(progress)}</>;
};
export default memo(Progress);
