import { type FC, memo, useEffect } from "react";
import { useStage } from "@/common/hooks/use-stage";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import { Stage } from "@/common/enum";
import { useUser } from "@/common/store/user";
import { NeteaseServicesAuth } from "@/common/netease/services";
import AppModal from "@/common/components/modal";
import AppToast from "@/common/components/toast";
import AppContextMenu from "@/common/components/menu";

import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";
import AppMask from "@/common/components/fallback/app-mask";
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import Content from "./content";
import Float from "./float";
import PlayerModal from "./modal";
import Background from "./background";
import MusicSource from "./music-source";
import Bus from "./bus";
import User from "./user";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  const user = useUser();
  useAppLoaded();
  useEffect(() => {
    !user?.isLoggedIn && NeteaseServicesAuth.createLoginWindow();
  }, [user?.isLoggedIn]);

  return (
    <div
      className={`
        relative w-screen h-screen overflow-hidden scrollbar-hide
        flex flex-row flex-nowrap
    `}>
      {stage < Stage.Finally && <AppMask className="z-40 bg-white" />}
      <TopBar className="h-(--top-control-height) z-30 contain-strict" />
      <NavSide />
      <Content />
      {stage >= Stage.Finally && <PlayerBar className="h-(--playbar-height) z-10 contain-layout" />}
      {stage >= Stage.Finally && <PlayerModal className="contain-strict z-20" />}
      <AppErrorBoundary name="Widget" showError={false} autoReset panicAfterReset>
        {stage >= Stage.Immediately && <Background className="-z-10" />}
        {stage >= Stage.Second && <AppToast.Provider className="z-40" />}
        {stage >= Stage.Finally && <AppContextMenu.Provider className="z-40" />}
        {stage >= Stage.Finally && <AppModal.Provider className="z-35" />}
        {stage >= Stage.Second && <Float className="z-10" />}
      </AppErrorBoundary>
      <AppErrorBoundary name="PlayerSource" panic>
        {stage >= Stage.Second && <Bus />}
        {stage >= Stage.Second && <MusicSource />}
        {stage >= Stage.Immediately && <User />}
      </AppErrorBoundary>
    </div>
  );
};
export default memo(Layout);
