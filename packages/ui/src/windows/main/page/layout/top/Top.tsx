import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useUser } from "@mahiru/ui/common/store/user";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { ElectronServicesWindow } from "@mahiru/ui/common/source/electron/services";
import { useAtomValue } from "jotai";
import { playModalAtom, sidebarAtom } from "@mahiru/ui/windows/main/atoms/layout";

import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";
import TopLeft from "./TopLeft";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import Drag from "@mahiru/ui/common/components/drag/Drag";

const Top: FC<{ className?: string }> = ({ className }) => {
  const playModal = useAtomValue(playModalAtom);
  const sidebar = useAtomValue(sidebarAtom);
  const user = useUser();
  const isFullscreen = useListenable(ElectronServicesWindow.current).isFullscreen;

  return (
    <Drag
      className={cx(
        `
          absolute left-0 right-0 top-0 pr-4
          flex items-center
        `,
        playModal ? "text-white" : "text-(--text-color-on-main)",
        className
      )}>
      <AppErrorBoundary name="Top" showError={false} autoReset panicAfterReset>
        <div
          className={cx(
            `
            h-full overflow-hidden
            duration-300 ease-in-out transition-all
          `,
            sidebar ? "w-(--side-bar-expand-width)" : "w-(--side-bar-collapse-width)"
          )}>
          <TopLeft user={user} />
        </div>
        <div
          className={cx(
            `flex-1 flex flex-row gap-4 items-center justify-end`,
            isFullscreen && "hidden"
          )}>
          <TopSearch />
          {playModal && <TopAvatar user={user} />}
          <TopDivider />
          <TopControl />
        </div>
      </AppErrorBoundary>
    </Drag>
  );
};

export default memo(Top);
