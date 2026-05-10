import { FC, memo, useEffect, useMemo, useState } from "react";
import { useListenable } from "@mahiru/ui/public/hooks/useListenable";
import { useNavigate } from "react-router-dom";
import { RoutePath, RoutePathDisplay } from "@mahiru/ui/public/routes";
import { PlaylistSource } from "@mahiru/ui/public/enum";
import {
  ElectronServicesBus,
  ElectronServicesWindow
} from "@mahiru/ui/public/source/electron/services";
import { useThemeInjectFromBus } from "@mahiru/ui/public/hooks/useThemeInjectFromBus";

import KeepAliveOutlet from "@mahiru/ui/public/components/public/KeepAliveOutlet";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import AppToast from "@mahiru/ui/public/components/toast";
import AppContextMenu from "@mahiru/ui/public/components/menu";
import AcrylicBackground from "@mahiru/ui/public/components/public/AcrylicBackground";
import TopControlPure from "@mahiru/ui/public/components/public/TopControlPure";
import Drag from "@mahiru/ui/public/components/drag/Drag";
import { BackCtx } from "@mahiru/ui/windows/display/ctx/back";
import TopBack from "@mahiru/ui/public/components/top_control/TopBack";

const LayoutDisplay: FC<object> = () => {
  useThemeInjectFromBus();

  const navigate = useNavigate();
  const displayBus = useListenable(ElectronServicesBus.display);
  useEffect(() => {
    if (!displayBus.data) return;

    switch (displayBus.data.type) {
      case "playlist":
        navigate(
          RoutePathDisplay.playlist.withQuery(
            displayBus.data.id,
            displayBus.data.source === "like" ? PlaylistSource.Like : PlaylistSource.Normal
          )
        );
        break;
      case "album":
        navigate(RoutePath.withQuery(RoutePathDisplay.album, { id: displayBus.data.id }));
        break;
      case "artist":
        navigate(RoutePath.withQuery(RoutePathDisplay.artist, { id: displayBus.data.id }));
        break;
      case "search":
        navigate(
          RoutePath.withQuery(RoutePathDisplay.search, { keyword: displayBus.data.keyword })
        );
        break;
    }
    ElectronServicesBus.clear("displayBus");
    ElectronServicesWindow.current.focus();
  }, [displayBus.data, navigate]);
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
    <div className="w-screen h-screen relative overflow-hidden px-6 pt-10">
      <Drag className="absolute w-screen top-0 right-0 h-10  flex flex-row justify-between items-center px-4 text-(--text-color-on-main)">
        <TopBack
          exclude={[RoutePathDisplay.blank]}
          routePath={RoutePathDisplay}
          onClick={() => setBack(true)}
        />
        <TopControlPure />
      </Drag>
      <AppErrorBoundary name="LayoutDisplayContent" showError canReset>
        <div className="fixed inset-0 z-[-1]">
          <AcrylicBackground src={InfoBus.data?.backgroundCover} />
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
