import { FC } from "react";

import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import PlayerModal from "./Modal";
import Background from "./Background";
import Content from "./Content";
import ThemeColor from "./ThemeColor";
import FloatButtons from "./float";
import MusicSource from "@mahiru/ui/page/layout/MusicSource";
import { Stage, useStage } from "@mahiru/ui/hook/useStage";

const Layout: FC<object> = () => {
  const { stage } = useStage();
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="w-screen h-screen overflow-hidden relative">
        {stage >= Stage.Immediately && <TopBar />} {/* absolute z-30 */}
        {stage >= Stage.Second && <NavSide />} {/* absolute z-10 */}
        {stage >= Stage.Finally && <PlayerBar />} {/* absolute z-10 */}
        {stage >= Stage.Second && <Content />} {/*relative z-10*/}
      </div>
      {stage >= Stage.Finally && <Background />}
      {/* z-0 */}
      {stage >= Stage.Finally && <PlayerModal />} {/* z-20 */}
      {stage >= Stage.Second && <FloatButtons />}
      {stage >= Stage.Second && <ThemeColor />}
      {stage >= Stage.Finally && <MusicSource />}
    </div>
  );
};
export default Layout;
