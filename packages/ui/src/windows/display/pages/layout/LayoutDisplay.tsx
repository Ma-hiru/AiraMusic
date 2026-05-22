import { type FC, memo, useEffect, useMemo, useState } from "react";
import { useListenable } from "@mahiru/ui/common/hooks/useListenable";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/common/routes";
import { PlaylistSource } from "@mahiru/ui/common/enum";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/common/source/electron/services";
import { useThemeInjectFromBus } from "@mahiru/ui/common/hooks/useThemeInjectFromBus";

import KeepAliveOutlet from "@mahiru/ui/common/components/public/KeepAliveOutlet";
import AppErrorBoundary from "@mahiru/ui/common/components/fallback/AppErrorBoundary";
import AppToast from "@mahiru/ui/common/components/toast";
import AppContextMenu from "@mahiru/ui/common/components/menu";
import AcrylicBackground from "@mahiru/ui/common/components/public/AcrylicBackground";
import TopControlPure from "@mahiru/ui/common/components/public/TopControlPure";
import Drag from "@mahiru/ui/common/components/drag/Drag";
import { BackCtx } from "@mahiru/ui/windows/display/ctx/back";
import TopBack from "@mahiru/ui/common/components/top_control/TopBack";
import { useLatestRef } from "@mahiru/ui/common/hooks/useLatestRef";

const LayoutDisplay: FC<object> = () => {
  useThemeInjectFromBus();

  const navigate = useNavigate();
  const location = useLocation();
  const pathRef = useLatestRef(location.pathname + location.search);
  const displayBus = useListenable(ElectronServicesBus.display);
  useEffect(() => {
    if (!displayBus.data) return;
    const path = pathRef.current;

    let target = path;
    switch (displayBus.data.type) {
      case "playlist":
        target = RoutePathDisplay.playlist.withQuery(
          displayBus.data.id,
          displayBus.data.source === "like" ? PlaylistSource.Like : PlaylistSource.Normal
        );
        break;
      case "album":
        target = RoutePath.withQuery(RoutePathDisplay.album, { id: displayBus.data.id });
        break;
      case "artist":
        target = RoutePath.withQuery(RoutePathDisplay.artist, { id: displayBus.data.id });
        break;
      case "search":
        target = RoutePath.withQuery(RoutePathDisplay.search, {
          keyword: displayBus.data.keyword
        });
        break;
      case "settings":
        target = RoutePath.withQuery(RoutePathDisplay.settings, {});
    }
    path !== target && navigate(target);

    ElectronServicesBus.clear("displayBus");
    ElectronServicesWindow.current.focus();
  }, [displayBus.data, navigate, pathRef]);
  useEffect(() => {
    ElectronServicesBus.mainBusUpdater.send("info");
    ElectronServicesBus.mainBusUpdater.send("player");
  }, []);

  const InfoBus = useListenable(ElectronServicesBus.info);

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
      <Drag className="absolute w-screen top-0 right-0 h-10  flex flex-row justify-between items-center px-4 text-(--text-color-on-main) z-50">
        <TopBack
          exclude={[RoutePathDisplay.blank]}
          routePath={RoutePathDisplay}
          onClick={() => setBack(true)}
        />
        <TopControlPure />
      </Drag>
      <AppErrorBoundary name="LayoutDisplayContent" showError canReset>
        <div className="fixed inset-0 z-[-1]">
          <AcrylicBackground src={InfoBus.data?.backgroundCover} opacity={0.65} blur={60} />
        </div>
        <BackCtx value={backCtxValue}>
          <KeepAliveOutlet maxCache={3} />
        </BackCtx>
        <AppToast.Provider />
        <AppContextMenu.Provider />
      </AppErrorBoundary>
    </div>
  );
};

export default memo(LayoutDisplay);
