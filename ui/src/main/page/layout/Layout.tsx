import { FC, memo, useEffect, useMemo } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { useAppLoaded } from "@mahiru/ui/public/hooks/useAppLoaded";
import { Stage } from "@mahiru/ui/public/enum";

import MenuProvider from "@mahiru/ui/public/components/menu/MenuProvider";
import ToastProvider from "@mahiru/ui/public/components/toast/ToastProvider";
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import Content from "./Content";
import Float from "./float";
import PlayerModal from "./Modal";
import Background from "./Background";
import MusicSource from "./MusicSource";
import Bus from "./Bus";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  const { promise, resolve } = useMemo(() => Promise.withResolvers<void>(), []);

  useAppLoaded(promise);

  useEffect(() => {
    stage >= Stage.Finally && resolve();
  }, [resolve, stage]);

  return (
    <div
      className={`
        relative w-screen h-screen overflow-hidden scrollbar-hide
        flex flex-row flex-nowrap
    `}>
      <TopBar className="h-10 z-30" />
      <NavSide />
      <Content />
      {stage >= Stage.Finally && <PlayerBar className="h-18 z-10" />}
      {stage >= Stage.Finally && <PlayerModal className="z-20" />}
      {stage >= Stage.Immediately && <Background className="-z-10" />}
      {stage >= Stage.Immediately && <ToastProvider className="z-35" />}
      {stage >= Stage.Immediately && <MenuProvider className="z-15" />}
      {stage >= Stage.Second && <Bus />}
      {stage >= Stage.Second && <Float className="z-10" />}
      {stage >= Stage.Second && <MusicSource />}
    </div>
  );
};
export default memo(Layout);
