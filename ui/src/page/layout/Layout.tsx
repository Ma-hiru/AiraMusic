import { FC } from "react";
import TopBar from "@mahiru/ui/page/layout/top/Top";
import PlayerBar from "@mahiru/ui/page/layout/bar/Bar";
import NavSide from "@mahiru/ui/page/layout/nav/Nav";
import KeepAliveOutlet from "@mahiru/ui/componets/public/KeepAliveOutlet";
import PlayerModal from "@mahiru/ui/page/layout/model/Modal";

const Layout: FC<object> = () => {
  return (
    <div className="relative w-screen h-screen overflow-hidden">
      <div className="w-screen h-screen overflow-hidden relative bg-[#f7f9fc]">
        <TopBar />
        <NavSide />
        <PlayerBar />
        <div className="w-screen h-screen pb-18 pl-48">
          <KeepAliveOutlet />
        </div>
      </div>
      <PlayerModal />
    </div>
  );
};
export default Layout;
