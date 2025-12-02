import { FC } from "react";
import "@applemusic-like-lyrics/core/style.css";
import Cover from "./Cover";
import Control from "./Control";
import Background from "./Background";
import Lyric from "./Lyric";
import LyricChange from "./LyricChange";
import Title from "./Title";
import Artist from "@mahiru/ui/page/player/Artist";

export const PlayerPage: FC = () => {
  return (
    <div className="w-screen h-screen relative">
      <div className="absolute w-1/2 h-screen z-10 flex justify-center items-center">
        <div className="flex flex-col justify-center items-center ease-in-out duration-300 transition-all w-[150px] sm:w-[200px] md:w-[250px] lg:w-[300px] relative -top-1">
          <div className="h-25 w-full flex flex-col justify-end pb-4">
            <Title />
          </div>
          <div className="w-full h-[150px] sm:h-[200px] md:h-[250px] lg:h-[300px]">
            <Cover />
          </div>
          <div className="h-30 w-full flex flex-col justify-center gap-2">
            <Artist />
            <Control />
          </div>
        </div>
      </div>
      <Background />
      <Lyric />
      <LyricChange />
    </div>
  );
};
export default PlayerPage;
