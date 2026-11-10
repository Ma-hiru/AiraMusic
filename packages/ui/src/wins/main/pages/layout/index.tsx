import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, type FC, useState, useEffect } from "react";
import { Stage } from "@/common/enum";
import { useStage } from "@/common/hooks/use-stage";
import { playModalAtom } from "@/wins/main/atoms/layout";
import { useAppLoaded } from "@/common/hooks/use-app-loaded";
import AppModal from "@/common/components/display/modal";
import AppToast from "@/common/components/display/toast";
import AppDrawer from "@/common/components/display/drawer";
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
import TopBack from "./top/top-back";
import Background from "./background";
import MusicSource from "./music-source";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  const playerOpened = useAtomValue(playModalAtom);
  const [loaded, setLoaded] = useState(false);
  const [wait, setWait] = useState(true);

  useAppLoaded();

  useEffect(() => {
    if (stage >= Stage.Finally) {
      const timer = setTimeout(() => setWait(false), 1_500);
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
      <TopBack />
      <NavSide />
      <Content />
      {stage >= Stage.Finally && <PlayerBar className="h-(--playbar-height) z-10 contain-layout" />}
      {stage >= Stage.Finally && <PlayerModal className="contain-strict z-20" />}
      <AppErrorBoundary name="Widget" showError={false} autoReset panicAfterReset>
        {stage >= Stage.Immediately && (
          <Background className="-z-10" onLoaded={() => setLoaded(true)} />
        )}
        {stage >= Stage.Second && <AppToast.Provider className="z-(--z-index-main-toast)!" />}
        {stage >= Stage.Finally && (
          <AppContextMenu.Provider className="z-(--z-index-main-context-menu)!" />
        )}
        {stage >= Stage.Finally && <AppModal.Provider className="z-(--z-index-main-modal)!" />}
        {stage >= Stage.Finally && (
          <AppDrawer.Provider
            className={cx(
              // 播放层开合会改变抽屉可用的底边界，过渡时长与播放层位移保持一致
              "z-(--z-index-main-drawer)! top-(--top-control-height)! transition-[bottom] duration-400 ease-in-out",
              !playerOpened && "bottom-(--playbar-height)!"
            )}
          />
        )}
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
