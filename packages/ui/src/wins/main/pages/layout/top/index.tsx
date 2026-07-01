import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, type FC } from "react";
import { useUser } from "@/common/store/user";
import { RendererWindow } from "@/common/lib/window";
import { useListenable } from "@/common/hooks/use-listenable";
import { sidebarAtom, playModalAtom } from "@/wins/main/atoms/layout";
import Drag from "@/common/components/layout/drag/drag";
import Divider from "@/common/components/layout/divider";

import TopLeft from "./top-left";
import TopAvatar from "./top-avatar";
import TopSearch from "./top-search";
import TopControl from "./top-control";

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
        <Divider reverse />
        <TopControl />
      </div>
    </Drag>
  );
};

export default memo(Top);
