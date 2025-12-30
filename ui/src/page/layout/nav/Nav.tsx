import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";
import { useLayoutStore } from "@mahiru/ui/store/layout";
import { useUserStore } from "@mahiru/ui/store/user";

import Avatar from "@mahiru/ui/page/layout/nav/NavAvatar";
import NavSideDivider from "@mahiru/ui/page/layout/nav/NavDivider";
import NavPlayList from "@mahiru/ui/page/layout/nav/NavPlaylist";
import NavMenu from "@mahiru/ui/page/layout/nav/NavMenu";

const Nav: FC<object> = () => {
  const { UserPlaylistSummary } = useUserStore();
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
