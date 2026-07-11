import { memo, type FC, useState, useEffect } from "react";
import { Stage } from "@/common/enum";
import { useStage } from "@/common/hooks/use-stage";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import AppMask from "@/common/components/fallback/app-mask";
import AppContextMenu from "@/common/components/display/menu";
import AppErrorBoundary from "@/common/components/fallback/app-error-boundary";

import Bus from "./bus";
import User from "./user";
import TopBar from "./top";
import Float from "./float";
import NavSide from "./nav";
import PlayerBar from "./bar";
import Content from "./content";
import PlayerModal from "./modal";
import Background from "./background";
import MusicSource from "./music-source";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  const [loaded, setLoaded] = useState(false);
  const [wait, setWait] = useState(true);

  useAppLoaded();

  useEffect(() => {
    if (stage >= Stage.Finally) {
      const timer = setTimeout(() => setWait(false), 3000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [stage]);

  return (
    <div
      className={`
        relative w-screen h-screen overflow-hidden scrollbar-hide
        flex flex-row flex-nowrap
    `}>
      <AppMask className="z-40 bg-white text-black" show={!loaded || wait} />
      <TopBar className="h-(--top-control-height) z-30 contain-strict" />
      <NavSide />
      <Content />
      {stage >= Stage.Finally && <PlayerBar className="h-(--playbar-height) z-10 contain-layout" />}
      {stage >= Stage.Finally && <PlayerModal className="contain-strict z-20" />}
      <AppErrorBoundary name="Widget" showError={false} autoReset panicAfterReset>
        {stage >= Stage.Immediately && (
          <Background className="-z-10" onLoaded={() => setLoaded(true)} />
        )}
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
