import { FC } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { Stage } from "@mahiru/ui/public/enum";

import Cover from "./Cover";
import Control from "./Control";
import Background from "./Background";
import Lyric from "./Lyric";
import LyricChange from "./LyricChange";
import Title from "./Title";
import Artist from "./Artist";
import Spectrum from "./Spectrum";

export const PlayerPage: FC = () => {
  const { stage } = useStage();
  return (
    <div className="w-screen h-screen relative">
      <div className="absolute w-1/2 h-screen z-10 flex justify-center items-center">
        <div className="flex flex-col justify-center items-center ease-in-out duration-300 transition-all w-37.5 sm:w-50 md:w-62.5 lg:w-75 relative -top-1">
          <div className="h-25 w-full flex flex-col justify-end pb-4">
            {stage >= Stage.Immediately && <Title />}
          </div>
          <div className="w-full h-37.5 sm:h-50 md:h-62.5 lg:h-75">
            {stage >= Stage.Second && <Cover />}
          </div>
          <div className="h-40 w-full flex flex-col justify-center gap-2">
            {stage >= Stage.First && <Artist />}
            {stage >= Stage.Second && <Control />}
            {stage >= Stage.Finally && <Spectrum />}
          </div>
        </div>
      </div>
      {stage >= Stage.Finally && <Background />}
      {stage >= Stage.Finally && <Lyric />}
      {stage >= Stage.Immediately && <LyricChange />}
    </div>
  );
};
export default PlayerPage;
