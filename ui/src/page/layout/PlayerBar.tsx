import { FC, memo } from "react";
import PlayerBarCover from "@mahiru/ui/page/layout/componets/PlayerBarCover";
import PlayerBarControl from "@mahiru/ui/page/layout/componets/PlayerBarControl";

const PlayerBar: FC<object> = () => {
  return (
    <div className="absolute h-18 bottom-0 left-0 right-0 bg-white px-6 shadow-lg grid grid-rows-1 grid-cols-[1fr_auto_1fr] items-center">
      <PlayerBarCover />
      <PlayerBarControl />
      <div></div>
    </div>
  );
};
export default memo(PlayerBar);
