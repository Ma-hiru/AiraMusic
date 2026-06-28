import { type FC, memo, useCallback, useRef, useState } from "react";
import { cx } from "@emotion/css";
import { useUser } from "@/common/store/user";
import { useStage } from "@/common/hooks/use-stage";
import { Stage } from "@/common/enum";
import { useAtomValue } from "jotai";
import { sidebarAtom } from "@/wins/main/atoms/layout";
import { RendererIPCMessageBus } from "@/common/lib/bus";

import NavMenu from "./nav-menu";
import NavFloat from "./float";
import NavTab from "./tab";
import NavPlayList, { type NavPlaylistRef } from "./nav-playlist";
import Divider from "@/common/components/layout/divider";

const Nav: FC<object> = () => {
  const { stage } = useStage();
  const [category, setCategory] = useState(0);
  const [canScrollTop, setCanScrollTop] = useState(false);
  const [keyword, setKeyword] = useState("");
  const user = useUser();
  const playlistRef = useRef<Nullable<NavPlaylistRef>>(null);
  const sidebar = useAtomValue(sidebarAtom);
  const displayPlaylist = (user?.playlistCount || 0) > 0;

  const onScrollTop = useCallback(() => playlistRef.current?.scrollTop(), []);

  const onCreated = useCallback(() => {
    RendererIPCMessageBus.modified.twoWay({
      type: "user-playlist"
    });
  }, []);

  return (
    <section
      className={cx(
        `
          flex flex-col relative
          pb-(--playbar-height) pt-[calc(var(--top-control-height)+10px)]  overflow-hidden
          backdrop-saturate-120 backdrop-blur-lg contain-strict
          ease-in-out duration-300 transition-all
          bg-[#f0f3f6]/20
        `,
        sidebar ? "w-(--side-bar-expand-width)" : "w-(--side-bar-collapse-width)"
      )}>
      {stage >= Stage.Immediately && <NavMenu className="shrink-0" barOpened={sidebar} />}
      {stage >= Stage.Second && displayPlaylist && <Divider className="mt-4 mx-3 shrink-0" />}
      {stage >= Stage.Second && displayPlaylist && (
        <NavTab category={category} setCategory={setCategory} sidebar={sidebar} />
      )}
      {stage >= Stage.Finally && displayPlaylist && (
        <NavPlayList
          className="flex-1"
          ref={playlistRef}
          user={user!}
          category={category === 0 ? "user" : "star"}
          sidebarOpen={sidebar}
          setCanScrollTop={setCanScrollTop}
          keyword={keyword}
        />
      )}
      <NavFloat
        setKeyword={setKeyword}
        canScroll={canScrollTop}
        sideBar={sidebar}
        onScrollTop={onScrollTop}
        onCreated={onCreated}
      />
    </section>
  );
};

export default memo(Nav);
