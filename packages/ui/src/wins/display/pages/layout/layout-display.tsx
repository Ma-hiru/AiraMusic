import { type FC, memo, useEffect, useMemo, useState } from "react";
import { useListenable } from "@/common/hooks/use-listenable";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { PlaylistSource } from "@/common/enum";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { BackCtx } from "@/wins/display/ctx/back";

import KeepAliveOutlet from "@/common/components/other/keep-alive-outlet";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";
import AppToast from "@/common/components/display/toast";
import AppContextMenu from "@/common/components/display/menu";
import AppModal from "@/common/components/display/modal";
import AcrylicBackground from "@/common/components/display/acrylic-background";
import TopControlPure from "@/common/components/layout/top/control";
import Drag from "@/common/components/layout/drag/drag";
import TopBack from "@/common/components/layout/top/back";
import DisplayFloat from "./float";

const LayoutDisplay: FC<object> = () => {
  const themeBus = useThemeInjectFromBus();
  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useLatestRef(location.pathname + location.search);
  const displayBus = useListenable(RendererIPCMessageBus.display);

  useEffect(() => {
    const data = displayBus.data;
    if (!data.length) return;

    const path = pathRef.current;
    let target = path;

    for (const action of data) {
      switch (action.type) {
        case "playlist":
          target = RoutePathDisplay.playlist.withQuery(
            action.id,
            action.source === "like" ? PlaylistSource.Like : PlaylistSource.Normal
          );
          break;
        case "album":
          target = RoutePath.withQuery(RoutePathDisplay.album, { id: action.id });
          break;
        case "artist":
          target = RoutePath.withQuery(RoutePathDisplay.artist, { id: action.id });
          break;
        case "search":
          target = RoutePath.withQuery(RoutePathDisplay.search, {
            keyword: action.keyword
          });
          break;
        case "settings":
          target = RoutePath.withQuery(RoutePathDisplay.settings, {});
          break;
        case "history":
          target = RoutePathDisplay.history;
          break;
      }
    }

    path !== target && navigate(target);
    RendererWindow.current.focus();
    RendererIPCMessageBus.consume(displayBus.type);
  }, [navigate, pathRef, displayBus.data, displayBus.type]);

  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("track-meta");
  }, []);

  const [back, setBack] = useState(false);
  const backCtxValue = useMemo(
    () => ({
      back,
      markBack: () => {
        setBack(true);
      }
    }),
    [back]
  );

  return (
    <div className="w-screen h-screen relative overflow-hidden">
      <Drag className="absolute w-screen top-0 right-0 h-10  flex flex-row justify-between items-center px-4 z-50">
        <TopBack exclude={["blank"]} routePath={RoutePathDisplay} onClick={() => setBack(true)} />
        <TopControlPure pin mini />
      </Drag>
      <AppErrorBoundary name="LayoutDisplayContent" showError canReset>
        <div className="fixed inset-0 z-[-1]">
          <AcrylicBackground src={themeBus.data?.backgroundCover} opacity={0.65} blur={60} />
        </div>
        <BackCtx value={backCtxValue}>
          <KeepAliveOutlet maxCache={3} />
        </BackCtx>
        <DisplayFloat />
        <AppToast.Provider className="z-50!" />
        <AppContextMenu.Provider className="z-50!" />
        <AppModal.Provider />
      </AppErrorBoundary>
    </div>
  );
};

export default memo(LayoutDisplay);
