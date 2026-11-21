import { memo, type FC } from "react";
import { usePlayProgress } from "@/wins/main/hooks/use-play-progress";
import NormalPlayerProgress from "@/common/components/display/player-progress/normal";

const BarProgress: FC<object> = () => {
  const { onUpdate, track, progressRef } = usePlayProgress("bar");
  return (
    <NormalPlayerProgress
      ref={progressRef}
      track={track}
      chorusClassName="bg-primary-text!"
      bufferClassName="block h-full bg-(--text-color-on-main)/35! rounded-none rounded-r-full!"
      percentClassName="absolute left-0 top-0 block h-full bg-primary! bg-linear-to-r from-primary to-tertiary backdrop-blur-none rounded-none rounded-r-full"
      onUpdate={onUpdate}
      containerClassName={`
         absolute! w-screen h-1! bottom-(--playbar-height) overflow-hidden contain-strict
         shadow-[0_5px_10px_-5px_rgba(0,0,0,0.15)] backdrop-blur-lg
         cursor-pointer ease-in-out transition-all duration-300 hover:h-2!
         bg-transparent! rounded-none!
      `}
    />
  );
};

export default memo(BarProgress);
