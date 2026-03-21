import { FC, memo, useEffect } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import Content from "./Content";
import Float from "./float";
import PlayerModal from "./Modal";
import Background from "./Background";
import MusicSource from "./MusicSource";

import MenuProvider from "@mahiru/ui/public/components/menu/MenuProvider";
import ToastProvider from "@mahiru/ui/public/components/toast/ToastProvider";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  // 禁 Tab
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div
      className={`
        relative w-screen h-screen overflow-hidden scrollbar-hide
        flex flex-row flex-nowrap
    `}>
      <TopBar className="h-10 z-30" />
      <NavSide />
      <Content />
      <PlayerBar className="h-18 z-10" />
      <PlayerModal className="z-20" />
      <Background className="-z-10" />
      <ToastProvider className="z-35" />
      <MenuProvider className="z-15" />
      <Float className="z-10" />
      <MusicSource />
    </div>
  );
};
export default memo(Layout);
