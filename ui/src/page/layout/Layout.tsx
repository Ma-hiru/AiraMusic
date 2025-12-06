import { FC } from "react";
import TopBar from "./top";
import PlayerBar from "./bar";
import NavSide from "./nav";
import PlayerModal from "./Modal";
import Background from "./Background";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";
import LayoutProvider from "@mahiru/ui/ctx/LayoutProvider";
import RouterBack from "@mahiru/ui/page/layout/RouterBack";
import SpectrumProvider from "@mahiru/ui/ctx/SpectrumProvider";

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
              <div className="w-screen h-screen pb-18 pl-48 z-[9] relative">
                <KeepAliveOutlet /> {/* relative z-10 */}
              </div>
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
