import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useUser } from "@mahiru/ui/public/store/user";

import NavPlayList from "./NavPlaylist";
import NavSideDivider from "./NavDivider";
import NavMenu from "./NavMenu";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { Stage } from "@mahiru/ui/public/enum";

const Nav: FC<object> = () => {
  const { layout, theme } = useLayoutStore();
  const { stage } = useStage();
  const user = useUser();
  const displayPlaylist = (user?.playlistCount || 0) > 0;

  return (
    <div
      className={cx(
        `
          grid grid-cols-1
          pb-18 pt-12  overflow-hidden
          backdrop-blur-lg contain-layout
          ease-in-out duration-300 transition-all
          border-r border-r-gray-500/10
        `,
        theme.backgroundCover ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]",
        layout.sideBar ? "w-40" : "w-20"
      )}>
      {stage >= Stage.Immediately && <NavMenu barOpened={layout.sideBar} />}
      {stage >= Stage.Second && displayPlaylist && <NavSideDivider />}
      {stage >= Stage.Finally && displayPlaylist && <NavPlayList user={user} layout={layout} />}
    </div>
  );
};
export default memo(Nav);
