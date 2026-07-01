import { memo, type FC } from "react";

import Meta from "./meta";
import Cover from "./cover";
import Lyric from "./lyric";
import Title from "./title";
import Control from "./control";
import Spectrum from "./spectrum";
import Background from "./background";
import LyricChange from "./lyric-change";

export const PlayerPage: FC = () => {
  return (
    <div className="w-screen h-screen relative">
      <div className="absolute w-1/2 h-screen z-10 flex justify-center items-center">
        <div className="flex flex-col justify-center items-center ease-in-out duration-300 transition-all w-30 sm:w-45 md:w-60 lg:w-75 xl:w-85 2xl:w-95 sm:text-sm md:text-base lg:text-lg xl:text-xl 2xl:text-2xl relative -top-1">
          <Title className="w-full h-20 xl:h-30" />
          <Cover className="w-full aspect-square mt-2" />
          <div className="h-40 w-full flex flex-col justify-center gap-2">
            <Meta className="text-[80%] xl:text-[70%]" />
            <Control itemClassName="sm:size-5! lg:size-6!" />
            <Spectrum className="lg:h-7! 2xl:h-10!" />
          </div>
        </div>
      </div>
      <Background />
      <Lyric />
      <LyricChange />
    </div>
  );
};

export default memo(PlayerPage);
