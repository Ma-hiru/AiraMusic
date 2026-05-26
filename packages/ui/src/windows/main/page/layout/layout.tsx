import { type FC, memo, useEffect } from "react";
import { useStage } from "@mahiru/ui/common/hooks/use-stage";
import { useAppLoaded } from "@mahiru/ui/common/hooks/use-app-loaded";
import { Stage } from "@mahiru/ui/common/enum";
import { useUser } from "@mahiru/ui/common/store/user";
import { NeteaseServicesAuth } from "@mahiru/ui/common/source/netease/services";
import AppToast from "@mahiru/ui/common/components/toast";
import AppContextMenu from "@mahiru/ui/common/components/menu";

import AppErrorBoundary from "../../../../common/components/fallback/app-error-boundary";
import AppMask from "../../../../common/components/fallback/app-mask";
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
        {stage >= Stage.Immediately && <AppToast.Provider className="z-35" />}
        {stage >= Stage.Immediately && <AppContextMenu.Provider className="z-15" />}
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
