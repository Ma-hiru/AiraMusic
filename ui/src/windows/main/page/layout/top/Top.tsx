import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/windows/main/store/layout";
import { useUser } from "@mahiru/ui/public/store/user";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";
import ElectronServices from "@mahiru/ui/public/source/electron/services";

import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";
import TopLeft from "./TopLeft";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import Drag from "@mahiru/ui/public/components/drag/Drag";

const Top: FC<{ className?: string }> = ({ className }) => {
  const { layout } = useLayoutStore();
  const isFullscreen = useListenableHook(ElectronServices.Window.current).isFullscreen;
  const user = useUser();

  return (
    <Drag
      className={cx(
        `
          absolute left-0 right-0 top-0 pr-4
          flex items-center
        `,
        layout.playModal ? "text-white" : "text-(--text-color-on-main)",
        className
      )}>
      <AppErrorBoundary name="Top" showError={false} autoReset panicAfterReset>
        <div
          className={cx(
            `
            h-full overflow-hidden
            duration-300 ease-in-out transition-all
          `,
            layout.sideBar ? "w-40" : "w-20"
          )}>
          <TopLeft user={user} layout={layout} />
        </div>
        <div
          className={cx(
            `flex-1 flex flex-row gap-4 items-center justify-end`,
            isFullscreen && "hidden"
          )}>
          <TopSearch />
          {layout.playModal && <TopAvatar user={user} />}
          <TopDivider />
          <TopControl />
        </div>
      </AppErrorBoundary>
    </Drag>
  );
};

export default memo(Top);
