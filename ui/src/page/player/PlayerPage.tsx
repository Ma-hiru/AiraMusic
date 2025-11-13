import { FC } from "react";
import "@applemusic-like-lyrics/core/style.css";
import Cover from "@mahiru/ui/page/player/Cover";
import Control from "@mahiru/ui/page/player/Control";
import Background from "@mahiru/ui/page/player/Background";
import Lyric from "@mahiru/ui/page/player/Lyric";
import Drag from "@mahiru/ui/componets/public/Drag";

export const PlayerPage: FC = () => {
  return (
    <div className="w-screen h-screen relative">
      <Drag />
      <div className="absolute w-1/2 h-screen flex items-center justify-center z-10 flex-col gap-8">
        <Cover />
        <Control />
      </div>
      <Background />
      <Lyric />
    </div>
  );
};
export default PlayerPage;
