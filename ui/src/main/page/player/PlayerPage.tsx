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
// import Spectrum from "./Spectrum";

export const PlayerPage: FC = () => {
  const { stage } = useStage();
  return (
    <div className="w-screen h-screen relative">
      <div className="absolute w-1/2 h-screen z-10 flex justify-center items-center">
        <div className="flex flex-col justify-center items-center ease-in-out duration-300 transition-all w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px] relative -top-1">
          <div className="h-25 w-full flex flex-col justify-end pb-4">
            {stage >= Stage.Immediately && <Title />}
          </div>
          <div className="w-full h-[150px] sm:h-[200px] md:h-[250px] lg:h-[300px]">
            {stage >= Stage.Second && <Cover />}
          </div>
          <div className="h-40 w-full flex flex-col justify-center gap-2">
            {stage >= Stage.First && <Artist />}
            {stage >= Stage.Second && <Control />}
            {/*{stage >= Stage.Finally && <Spectrum />}*/}
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
