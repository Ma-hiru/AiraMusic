import { type FC, memo, useEffect, useMemo, useState } from "react";
import { useListenable } from "@/common/hooks/use-listenable";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@/common/routes";
import { RendererWindow } from "@/common/lib/window";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useLatestRef } from "@/common/hooks/use-latest-ref";
import { useSettings } from "@/common/store/settings";
import { useThemeInjectFromBus } from "@/common/hooks/use-theme-inject-from-bus";
import { BackCtx } from "@/wins/display/ctx/back";
import { RendererModified } from "@/common/lib/modified";

import KeepAliveOutlet from "@/common/components/other/keep-alive-outlet";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";
import AppToast from "@/common/components/display/toast";
import AppContextMenu from "@/common/components/display/menu";
import AppModal from "@/common/components/display/modal";
import AcrylicBackground from "@/common/components/display/acrylic-background";
import Control from "@/common/components/layout/top/control";
import Drag from "@/common/components/layout/drag/drag";
import TopBack from "@/common/components/layout/top/back";
import DisplayFloat from "./float";
import Title from "./title";

const LayoutDisplay: FC<object> = () => {
  const themeBus = useThemeInjectFromBus();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useSettings();
  const pathRef = useLatestRef(location.pathname + location.search);
  const locationRef = useLatestRef(location);
  const displayBus = useListenable(RendererIPCMessageBus.display);
  const modifiedBus = useListenable(RendererIPCMessageBus.modified);

  useEffect(() => {
    const data = displayBus.data;
    if (!data.length) return;
    RendererIPCMessageBus.consume(displayBus.type);

    const path = pathRef.current;
    let target = path;

    for (const action of data) {
      switch (action.type) {
        case "playlist":
          target = RoutePathDisplay.playlist.withQuery(
            action.id,
            action.source === "like" ? "like" : "normal"
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
  }, [navigate, pathRef, displayBus.data, displayBus.type]);

  useEffect(() => {
    RendererIPCMessageBus.updater.deliver("track-meta");
  }, []);

  useEffect(() => {
    const modifies = modifiedBus.data;
    RendererIPCMessageBus.consume(modifiedBus.type);

    for (const m of modifies) {
      switch (m.type) {
        case "playlist-update":
          RendererModified.mark({
            type: "playlist",
            source: m.source,
            id: m.id
          });
          break;
        case "remove-playlist": {
          const { id } = RoutePathDisplay.playlist.parseQuery(locationRef.current, false);
          if (id !== m.id) break;
          RendererModified.mark({
            navigate,
            type: "removePlaylist",
            id: m.id,
            homePath: RoutePathDisplay.blank
          });
          break;
        }
      }
    }
  }, [modifiedBus.data, modifiedBus.type, navigate, locationRef]);

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
      <Title />
      <Drag className="absolute w-screen top-0 right-0 h-10  flex flex-row justify-between items-center px-4 z-50">
        <TopBack exclude={["blank"]} routePath={RoutePathDisplay} onClick={() => setBack(true)} />
        <Control pin mini />
      </Drag>
      <AppErrorBoundary name="LayoutDisplayContent" showError canReset>
        <div className="fixed inset-0 z-[-1]">
          <AcrylicBackground
            fluidPaused
            src={themeBus.data?.backgroundCover}
            fluid={settings.performance.useHomeFluid}
            fluidSpeed={settings.performance.homeFluidSpeed}
            opacity={0.6}
            brightness={0.3}
            blur={60}
          />
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
