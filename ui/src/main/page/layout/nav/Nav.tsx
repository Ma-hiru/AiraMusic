import { FC, memo } from "react";
import { cx } from "@emotion/css";
import { useLayoutStore } from "@mahiru/ui/main/store/layout";
// import { useStage } from "@mahiru/ui/public/hooks/useStage";
// import { usePlayerStore } from "@mahiru/ui/main/store/player";
// import { Stage } from "@mahiru/ui/public/enum";
//
// import Avatar from "./NavAvatar";
// import NavSideDivider from "./NavDivider";
// import NavPlayList from "./NavPlaylist";
// import NavMenu from "./NavMenu";

const Nav: FC<object> = () => {
  // const { UserPlaylistSummary } = usePlayerStore(["UserPlaylistSummary"]);
  const { layout, theme } = useLayoutStore();
  // const { stage } = useStage();
  return (
    <div
      className={cx(
        `
          grid grid-cols-1 grid-rows-[auto_auto_auto_1fr]
          pb-18 pt-10
          backdrop-blur-lg contain-layout
          ease-in-out duration-300 transition-all
          border-r border-r-gray-500/10
        `,
        theme.backgroundCover ? "bg-[#f0f3f6]/20" : "bg-[#f0f3f6]",
        layout.sideBar ? "w-44" : "w-22",
        "bg-blue-200"
      )}>
      {/*{stage >= Stage.First && <Avatar />}*/}
      {/*{stage >= Stage.Second && <NavMenu />}*/}
      {/*{!!UserPlaylistSummary?.length && stage > Stage.Second && <NavSideDivider />}*/}
      {/*{stage >= Stage.Finally && <NavPlayList />}*/}
    </div>
  );
};
export default memo(Nav);
