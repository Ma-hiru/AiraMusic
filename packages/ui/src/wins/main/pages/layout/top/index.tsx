import { type FC, memo } from "react";
import { cx } from "@emotion/css";
import { useUser } from "@/common/store/user";
import { useListenable } from "@/common/hooks/use-listenable";
import { RendererWindow } from "@/common/lib/window";
import { useAtomValue } from "jotai";
import { playModalAtom, sidebarAtom } from "@/wins/main/atoms/layout";

import TopControl from "./top-control";
import TopAvatar from "./top-avatar";
import TopDivider from "./top-divider";
import TopSearch from "./top-search";
import TopLeft from "./top-left";
import Drag from "@/common/components/drag/drag";

const Top: FC<{ className?: string }> = ({ className }) => {
  const playModal = useAtomValue(playModalAtom);
  const sidebar = useAtomValue(sidebarAtom);
  const user = useUser();
  const isFullscreen = useListenable(RendererWindow.current).isFullscreen;

  return (
    <Drag
      className={cx(
        `
          absolute left-0 right-0 top-0 pr-4
          flex items-center
        `,
        className
      )}>
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
    </Drag>
  );
};

export default memo(Top);
