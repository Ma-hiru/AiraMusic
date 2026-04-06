import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
import { useUser } from "@mahiru/ui/public/store/user";
import AppWindow from "@mahiru/ui/public/entry/window";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import useListenableHook from "@mahiru/ui/public/hooks/useListenableHook";

import TopControl from "./TopControl";
import TopAvatar from "./TopAvatar";
import TopDivider from "./TopDivider";
import TopSearch from "./TopSearch";
import TopLeft from "./TopLeft";

const Top: FC<{ className?: string }> = ({ className }) => {
  const { layout } = useLayoutStore();
  const isFullscreen = useListenableHook(AppWindow.current).isFullscreen;
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
    </Drag>
  );
};

export default memo(Top);
