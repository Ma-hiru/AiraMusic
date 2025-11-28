import { FC, useEffect } from "react";
import TopBar from "@mahiru/ui/page/layout/top/Top";
import PlayerBar from "@mahiru/ui/page/layout/bar/Bar";
import NavSide from "@mahiru/ui/page/layout/nav/Nav";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import PlayerModal from "@mahiru/ui/page/layout/model/Modal";
import PlayerProvider from "@mahiru/ui/ctx/PlayerProvider";
import LayoutProvider from "@mahiru/ui/ctx/LayoutProvider";
import AcrylicBackground from "@mahiru/ui/componets/public/AcrylicBackground";
import Background from "@mahiru/ui/page/layout/background/Background";

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
        </div>
      </LayoutProvider>
    </PlayerProvider>
  );
};
export default Layout;
