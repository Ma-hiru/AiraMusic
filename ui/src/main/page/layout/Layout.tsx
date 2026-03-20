import { FC, memo, useEffect } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
// import { Stage } from "@mahiru/ui/public/enum";
//
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import Content from "./Content";
import Float from "./float";
import PlayerModal from "./Modal";
import MenuProvider from "@mahiru/ui/public/components/menu/MenuProvider";
// import Background from "./Background";
// import ThemeColor from "./ThemeColor";
// import MusicSource from "./MusicSource";
// import MenuProvider from "@mahiru/ui/public/components/menu/MenuProvider";
// import ToastProvider from "@mahiru/ui/public/components/toast/ToastProvider";
// import ModalProvider from "@mahiru/ui/public/components/modal/ModalProvider";

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
      <TopBar /> {/* h-10 z-40*/}
      <NavSide />
      <Content />
      <PlayerBar /> {/*h-18 z-20*/}
      <PlayerModal /> {/*z-30*/}
      {/*{stage >= Stage.Immediately && <MenuProvider />} /!*z-15*!/*/}
      {/*{stage >= Stage.Immediately && <ToastProvider />}*/}
      {/*{stage >= Stage.Immediately && <ModalProvider />}*/}
      {/*{stage >= Stage.Second && <ThemeColor />}*/}
      {/*{stage >= Stage.Second && <MusicSource />}*/}
      {/*{stage >= Stage.Finally && <Background />} /!* z-0 *!/*/}
      <MenuProvider className="z-25" />
      <Float /> {/*z-10*/}
    </div>
  );
};
export default memo(Layout);
