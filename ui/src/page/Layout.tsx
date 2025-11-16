import { FC } from "react";
import TopBar from "@mahiru/ui/page/layout/TopBar";
import PlayerBar from "@mahiru/ui/page/layout/PlayerBar";
import NavSide from "@mahiru/ui/page/layout/NavSide";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import PlayerModal from "@mahiru/ui/page/layout/PlayerModal";

const Layout: FC<object> = () => {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="w-screen h-screen overflow-hidden relative">
        <TopBar />
        <NavSide />
        <PlayerBar />
        <KeepAliveOutlet />
      </div>
      <PlayerModal />
    </div>
  );
};
export default Layout;
