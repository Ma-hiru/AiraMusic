import { FC } from "react";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";
import SpectrumProvider from "@mahiru/ui/ctx/SpectrumProvider";

import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import PlayerModal from "./Modal";
import Background from "./Background";
import Content from "./Content";
import ThemeColor from "./ThemeColor";
import FloatButtons from "./float";

const Layout: FC<object> = () => {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <PlayerProvider>
        <SpectrumProvider>
          <div className="w-screen h-screen overflow-hidden relative">
            <TopBar /> {/* absolute z-30 */}
            <NavSide /> {/* absolute z-10 */}
            <PlayerBar /> {/* absolute z-10 */}
            <Content /> {/*relative z-10*/}
          </div>
          <Background /> {/* z-0 */}
          <PlayerModal /> {/* z-20 */}
          <FloatButtons />
          <ThemeColor />
        </SpectrumProvider>
      </PlayerProvider>
    </div>
  );
};
export default Layout;
