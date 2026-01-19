import { FC, useEffect } from "react";
import { useStage } from "@mahiru/ui/public/hooks/useStage";
import { Stage } from "@mahiru/ui/public/enum";

import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import PlayerModal from "./Modal";
import Background from "./Background";
import Content from "./Content";
import ThemeColor from "./ThemeColor";
import FloatButtons from "./float";
import MusicSource from "./MusicSource";
import MenuProvider from "@mahiru/ui/public/components/menu/MenuProvider";
import ToastProvider from "@mahiru/ui/public/components/toast/ToastProvider";
import ModalProvider from "@mahiru/ui/public/components/modal/ModalProvider";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  useEffect(() => {
    // 禁 Tab
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <div className="relative w-screen h-screen overflow-hidden scrollbar-hide">
      <div className="relative w-screen h-screen overflow-hidden scrollbar-hide">
        {stage >= Stage.Immediately && <TopBar />} {/* absolute z-30 */}
        {stage >= Stage.Second && <NavSide />} {/* absolute z-10 */}
        {stage >= Stage.Finally && <PlayerBar />} {/* absolute z-10 */}
        {stage >= Stage.Second && <Content />} {/*relative z-10*/}
      </div>
      {stage >= Stage.Immediately && <MenuProvider />} {/*z-15*/}
      {stage >= Stage.Immediately && <ToastProvider />}
      {stage >= Stage.Immediately && <ModalProvider />}
      {stage >= Stage.Second && <ThemeColor />}
      {stage >= Stage.Second && <MusicSource />}
      {stage >= Stage.Finally && <Background />} {/* z-0 */}
      {stage >= Stage.Finally && <PlayerModal />} {/* z-20 */}
      {stage >= Stage.Finally && <FloatButtons />}
    </div>
  );
};
export default Layout;
