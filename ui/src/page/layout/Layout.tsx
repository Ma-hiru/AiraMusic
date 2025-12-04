import { FC, useEffect } from "react";
import TopBar from "./Top";
import PlayerBar from "./Bar";
import NavSide from "./Nav";
import PlayerModal from "./Modal";
import Background from "./Background";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";
import LayoutProvider from "@mahiru/ui/ctx/LayoutProvider";
import RouterBack from "@mahiru/ui/page/layout/RouterBack";

const Layout: FC<object> = () => {
  useEffect(() => {
    window.node.event.loaded({
      win: "main",
      broadcast: false,
      showAfterLoaded: true
    });
  }, []);
  return (
    <PlayerProvider>
      <LayoutProvider>
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
      </LayoutProvider>
    </PlayerProvider>
  );
};
export default Layout;
