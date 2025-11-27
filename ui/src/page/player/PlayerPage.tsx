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
      <div className="absolute w-1/2 h-screen flex items-center justify-center z-10 flex-col gap-4 ease-in-out duration-300 transition-all">
        <Title />
        <Cover />
        <Artist />
        <Control />
      </div>
      <Background />
      <Lyric />
      <LyricChange />
    </div>
  );
};
export default PlayerPage;
