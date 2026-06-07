import { type FC, memo } from "react";
import { cx } from "@emotion/css";
import { useUser } from "@/common/store/user";
import { useStage } from "@/common/hooks/use-stage";
import { Stage } from "@/common/enum";
import { useAtomValue } from "jotai";
import { sidebarAtom } from "@/wins/main/atoms/layout";

import NavPlayList from "./nav-playlist";
import NavMenu from "./nav-menu";
import Divider from "@/common/components/layout/divider";

const Nav: FC<object> = () => {
  const sidebar = useAtomValue(sidebarAtom);
  const { stage } = useStage();
  const user = useUser();
  const displayPlaylist = (user?.playlistCount || 0) > 0;

  return (
    <div
      className={cx(
        `
          grid grid-cols-1
          pb-(--playbar-height) pt-[calc(var(--top-control-height)+10px)]  overflow-hidden
          backdrop-blur-lg contain-strict
          ease-in-out duration-300 transition-all
          border-r border-r-gray-500/10 bg-[#f0f3f6]/20
        `,
        sidebar ? "w-(--side-bar-expand-width)" : "w-(--side-bar-collapse-width)"
      )}>
      {stage >= Stage.Immediately && <NavMenu barOpened={sidebar} />}
      {stage >= Stage.Second && displayPlaylist && <Divider className="my-4 mx-3" />}
      {stage >= Stage.Finally && displayPlaylist && (
        <NavPlayList user={user} sidebarOpen={sidebar} />
      )}
    </div>
  );
};
export default memo(Nav);
