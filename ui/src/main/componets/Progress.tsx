import { FC, memo, ReactNode, useEffect } from "react";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { useUpdate } from "@mahiru/ui/public/hooks/useUpdate";

interface ProgressProps {
  render: (progress: PlayerProgress) => ReactNode;
}

const Progress: FC<ProgressProps> = ({ render }) => {
  const { PlayerProgressGetter, AudioRefGetter } = usePlayerStore([
    "PlayerProgressGetter",
    "AudioRefGetter"
  ]);
  const progress = PlayerProgressGetter();
  const audio = AudioRefGetter();
  const update = useUpdate();

  useEffect(() => {
    if (audio) {
      audio.addEventListener("timeupdate", update);
      return () => {
        audio.removeEventListener("timeupdate", update);
      };
    }
  }, [audio, update]);

  return <>{render(progress)}</>;
};
export default memo(Progress);
