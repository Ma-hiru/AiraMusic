import { memo, useState, useEffect } from "react";
import { RoutePathDisplay } from "@/common/routes";
import { RendererIPCMessageBus } from "@/common/lib/bus";
import { useRouterActive } from "@/common/hooks/use-router-active";
import { useDisplayPlayList } from "@/wins/display/hooks/use-display-play-list";
import { useDisplayTitleRegister } from "@/wins/display/hooks/use-display-title";
import PlayList from "@/common/components/page/play-list";

const PlayListDisplay = () => {
  const active = useRouterActive(RoutePathDisplay, "playList");
  const props = useDisplayPlayList(active);
  const { setTitle } = useDisplayTitleRegister("playList", "播放列表");
  const [statsRevision, setStatsRevision] = useState(0);

  useEffect(() => {
    if (!active) return;
    return RendererIPCMessageBus.history.addListener(() => setStatsRevision((value) => value + 1));
  }, [active]);
  useEffect(() => setTitle(`播放列表 ${props.tracks.length} 首`), [props.tracks.length, setTitle]);

  return <PlayList {...props} className="display-container pb-0!" statsRevision={statsRevision} />;
};

export default memo(PlayListDisplay);
