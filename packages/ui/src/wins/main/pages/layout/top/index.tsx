import { cx } from "@emotion/css";
import { useAtom, useAtomValue } from "jotai";
import { memo, type FC, useCallback } from "react";
import { useUser } from "@/common/store/user";
import { RendererDevice } from "@/common/lib/device";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useListenable } from "@/common/hooks/use-listenable";
import { NeteaseServicesAuth } from "@/common/netease/services";
import { sidebarAtom, playModalAtom } from "@/wins/main/atoms/layout";
import Drag from "@/common/components/layout/drag/drag";
import Divider from "@/common/components/layout/divider";

import TopLeft from "./top-left";
import TopAvatar from "./top-avatar";
import TopSearch from "./top-search";
import TopControl from "./top-control";

const isDarwin = (await RendererDevice.platform) === "darwin";

const Top: FC<{ className?: string }> = ({ className }) => {
  const [playModal, setPlayModal] = useAtom(playModalAtom);
  const sidebar = useAtomValue(sidebarAtom);
  const user = useUser();
  const isFullscreen = useListenable(RendererWindow.current).isFullscreen;

  const onClick = useCallback(async () => {
    if (!NeteaseServicesAuth.isLoggedIn) {
      await NeteaseServicesAuth.createLoginWindow();
    } else {
      await RendererWindow.display.reactReadyAwait();
      RendererIPCMessageBus.display.deliver({ type: "settings" });
    }
  }, []);

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
        <TopLeft
          user={user}
          isDarwin={isDarwin}
          playModal={playModal}
          onClick={() => (playModal ? setPlayModal(false) : onClick())}
        />
      </div>
      <div
        className={cx(
          `flex-1 flex flex-row gap-4 items-center justify-end`,
          isFullscreen && "hidden"
        )}>
        <TopSearch />
        <TopAvatar user={user} isDarwin={isDarwin} playModal={playModal} onClick={onClick} />
        <Divider reverse />
        <TopControl />
      </div>
    </Drag>
  );
};

export default memo(Top);
