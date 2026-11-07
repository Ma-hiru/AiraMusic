import { ListMusic } from "lucide-react";
import { memo, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RoutePathDisplay } from "@/common/routes";
import { PlayListQueue } from "@/common/components/page/play-list";
import { useDisplayPlayList } from "@/wins/display/hooks/use-display-play-list";
import IconButton from "@/common/components/data-input/icon-button";
import AppDrawer, { createPlayListDrawer } from "@/common/components/display/drawer";

const PlayListControl = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { create } = AppDrawer.useDrawer();
  const open = useCallback(() => {
    create(createPlayListDrawer, {
      content: <DisplayPlayListDrawerContent />,
      onPageAction: () => navigate(RoutePathDisplay.playList)
    });
  }, [create, navigate]);

  if (location.pathname === RoutePathDisplay.playList) return null;
  return (
    <IconButton label="播放列表" size="compact" variant="plain" icon={ListMusic} onClick={open} />
  );
};

const DisplayPlayListDrawerContent = () => {
  const props = useDisplayPlayList(true, AppDrawer.close);
  return <PlayListQueue {...props} />;
};

export default memo(PlayListControl);
