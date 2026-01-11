import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { usePlayerStore } from "@mahiru/ui/main/store/player";
import { Stage } from "@mahiru/ui/public/enum";

import Avatar from "./NavAvatar";
import NavSideDivider from "./NavDivider";
import NavPlayList from "./NavPlaylist";
import NavMenu from "./NavMenu";

const Nav: FC<object> = () => {
  const { UserPlaylistSummary } = usePlayerStore(["UserPlaylistSummary"]);
  const { PlayerTheme, SideBarOpen } = useLayoutStore(["PlayerTheme", "SideBarOpen"]);
  const { stage } = useStage();
  return (
    <div
      className={cx(
        "absolute grid grid-cols-1 grid-rows-[auto_auto_auto_1fr] left-0 top-0 bottom-0 pb-18 px-4 backdrop-blur-lg z-10 ease-in-out duration-300 transition-all border-r border-r-gray-500/10 contain-layout",
        PlayerTheme.BackgroundCover ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]",
        SideBarOpen ? "w-44" : "w-22"
      )}>
      {stage >= Stage.First && <Avatar />}
      {stage >= Stage.Second && <NavMenu />}
      {!!UserPlaylistSummary?.length && stage > Stage.Second && <NavSideDivider />}
      {stage >= Stage.Finally && <NavPlayList />}
    </div>
  );
};
export default memo(Nav);
