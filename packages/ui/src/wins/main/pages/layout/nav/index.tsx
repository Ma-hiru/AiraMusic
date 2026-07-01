import { cx } from "@emotion/css";
import { useAtomValue } from "jotai";
import { memo, useRef, type FC, useState, useCallback } from "react";
import { Stage } from "@/common/enum";
import { useUser } from "@/common/store/user";
import { useStage } from "@/common/hooks/use-stage";
import { sidebarAtom } from "@/wins/main/atoms/layout";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import Divider from "@/common/components/layout/divider";

import NavTab from "./tab";
import NavFloat from "./float";
import NavMenu from "./nav-menu";
import NavPlayList, { type NavPlaylistRef } from "./nav-playlist";

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
        <NavTab sidebar={sidebar} category={category} setCategory={setCategory} />
      )}
      {stage >= Stage.Finally && displayPlaylist && (
        <NavPlayList
          ref={playlistRef}
          className="flex-1"
          user={user!}
          keyword={keyword}
          sidebarOpen={sidebar}
          setCanScrollTop={setCanScrollTop}
          category={category === 0 ? "user" : "star"}
        />
      )}
      <NavFloat
        sideBar={sidebar}
        setKeyword={setKeyword}
        canScroll={canScrollTop}
        onCreated={onCreated}
        onScrollTop={onScrollTop}
      />
    </section>
  );
};

export default memo(Nav);
