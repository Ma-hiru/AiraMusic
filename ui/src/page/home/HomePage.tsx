import { FC, memo } from "react";
import { usePlayingBackground } from "@mahiru/ui/hook/usePlayingBackground";
import Title from "@mahiru/ui/componets/public/Title";

const HomePage: FC<object> = () => {
  usePlayingBackground();
  return (
    <div className="w-full h-full px-12 pt-10 contain-style contain-size contain-layout">
      <Title title="推荐" />
      <div className="flex flex-col gap-2"></div>
    </div>
  );
};

export default memo(HomePage);
