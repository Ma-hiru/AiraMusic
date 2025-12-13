import { FC } from "react";
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import PlayerModal from "./Modal";
import Background from "./Background";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";
import LayoutProvider from "@mahiru/ui/ctx/LayoutProvider";
import RouterBack from "@mahiru/ui/page/layout/RouterBack";
import SpectrumProvider from "@mahiru/ui/ctx/SpectrumProvider";
import Content from "@mahiru/ui/page/layout/Content";

const Layout: FC<object> = () => {
  return (
    <PlayerProvider>
      <LayoutProvider>
        <SpectrumProvider>
          <div className="relative w-screen h-screen overflow-hidden">
            <div className="w-screen h-screen overflow-hidden relative">
              <TopBar /> {/* absolute z-30 */}
              <NavSide /> {/* absolute z-10 */}
              <PlayerBar /> {/* absolute z-10 */}
              <Content /> {/*relative z-10*/}
            </div>
            <Background /> {/* z-0 */}
            <PlayerModal /> {/* z-20 */}
            <RouterBack />
          </div>
        </SpectrumProvider>
      </LayoutProvider>
    </PlayerProvider>
  );
};
export default Layout;
