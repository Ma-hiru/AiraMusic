import { FC, memo, useEffect } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";
import { Stage } from "@mahiru/ui/public/enum";
import { useUser } from "@mahiru/ui/public/store/user";
import NeteaseServices from "@mahiru/ui/public/source/netease/services";

import AppToast from "@mahiru/ui/public/components/toast";
import MenuProvider from "@mahiru/ui/public/components/menu/MenuProvider";
import AppErrorBoundary from "@mahiru/ui/public/components/fallback/AppErrorBoundary";
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import Content from "./Content";
import Float from "./float";
import PlayerModal from "./Modal";
import Background from "./Background";
import MusicSource from "./MusicSource";
import Bus from "./Bus";
import Mask from "./Mask";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  const user = useUser();
  useAppLoaded();
  useEffect(() => {
    !user?.isLoggedIn && NeteaseServices.Auth.createLoginWindow();
  }, [user?.isLoggedIn]);
  return (
    <div
      className={`
        relative w-screen h-screen overflow-hidden scrollbar-hide
        flex flex-row flex-nowrap
    `}>
      {stage < Stage.Finally && <Mask className="z-40" />}
      <TopBar className="h-10 z-30" />
      <NavSide />
      <Content />
      {stage >= Stage.Finally && <PlayerBar className="h-18 contain-strict z-10" />}
      {stage >= Stage.Finally && <PlayerModal className="contain-strict z-20" />}
      <AppErrorBoundary name="Widget" showError={false} autoReset panicAfterReset>
        {stage >= Stage.Immediately && <Background className="-z-10" />}
        {stage >= Stage.Immediately && <AppToast.Provider className="z-35" />}
        {stage >= Stage.Immediately && <MenuProvider className="z-15" />}
        {stage >= Stage.Second && <Float className="z-10" />}
      </AppErrorBoundary>
      <AppErrorBoundary name="PlayerSource" panic>
        {stage >= Stage.Second && <Bus />}
        {stage >= Stage.Second && <MusicSource />}
      </AppErrorBoundary>
    </div>
  );
};
export default memo(Layout);
