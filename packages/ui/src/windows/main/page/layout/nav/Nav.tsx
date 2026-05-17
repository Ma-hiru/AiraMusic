import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useUser } from "@mahiru/ui/common/store/user";
import { useStage } from "@mahiru/ui/common/hooks/useStage";
import { Stage } from "@mahiru/ui/common/enum";
import { useAtomValue } from "jotai";
import { sidebarAtom } from "@mahiru/ui/windows/main/atoms/layout";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";

import NavPlayList from "./NavPlaylist";
import NavSideDivider from "./NavDivider";
import NavMenu from "./NavMenu";

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
      <AppErrorBoundary name="NavMenu" showError={false} autoReset panicAfterReset>
        {stage >= Stage.Immediately && <NavMenu barOpened={sidebar} />}
      </AppErrorBoundary>
      {stage >= Stage.Second && displayPlaylist && <NavSideDivider />}
      <AppErrorBoundary name="NavPlayList" showError canReset className="w-40">
        {stage >= Stage.Finally && displayPlaylist && (
          <NavPlayList user={user} sidebarOpen={sidebar} />
        )}
      </AppErrorBoundary>
    </div>
  );
};
export default memo(Nav);
