import { type FC, memo, useCallback, useRef, useState } from "react";
import { useScrollAutoHide } from "@mahiru/ui/common/hooks/useScrollAutoHide";
import {
  NeteaseNetworkImage,
  NeteasePlaylistSummary,
  NeteaseUser
} from "@mahiru/ui/common/source/netease/models";
import AppUI from "@mahiru/ui/common/player/ui";
import NeteaseImage from "@mahiru/ui/common/components/image/NeteaseImage";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { RoutePathMain } from "@mahiru/ui/common/routes";
import { PlaylistSource } from "@mahiru/ui/common/enum";
import { useLocateOrScrollTopRegister } from "@mahiru/ui/windows/main/hooks/useLocateOrScrollTopRegister";
import ImageConstants from "@mahiru/ui/common/constants/image";

import VirtualList, {
  type VirtualListRow
} from "@mahiru/ui/common/components/virtual_list/VirtualList";

interface NavPlaylistProps {
  user: Nullable<NeteaseUser>;
  sidebarOpen: boolean;
}

const NavPlaylist: FC<NavPlaylistProps> = ({ user, sidebarOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = RoutePathMain.playlist.parseQuery(location);

  const [fastLocation, setFastLocation] = useState(false);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  useScrollAutoHide(containerRef, 800, !sidebarOpen);

  const gotoTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setFastLocation(true);
    AppUI.smoothScrollTo(container, 0, 500).finally(() => {
      setFastLocation(false);
    });
  }, []);

  const { canScrollTop } = useLocateOrScrollTopRegister({
    getScrollTopFunc: () => gotoTop
  });

  const onItemClick = useCallback(
    (item: NeteasePlaylistSummary) => {
      navigate(RoutePathMain.playlist.withQuery(item.id, PlaylistSource.Normal));
    },
    [navigate]
  );

  return (
    <div
      className="
        w-full h-full relative overflow-y-auto overflow-x-hidden
        contain-content will-change-scroll scrollbar
        text-(--text-color-on-main)
      "
      ref={containerRef}>
      <VirtualList
        RowComponent={RowComponent}
        items={user!.userPlaylists}
        itemHeight={57}
        containerRef={containerRef}
        overscan={10}
        onRangeUpdate={(range) => canScrollTop(range[0] > 5)}
        extraData={{ fastLocation, opened: sidebarOpen, activeID: Number(id) }}
        onItemClick={onItemClick}
      />
    </div>
  );
};

export default memo(NavPlaylist);

const RowComponent: VirtualListRow<
  NeteasePlaylistSummary,
  { fastLocation: boolean; opened: boolean; activeID: number }
> = (props) => {
  const { index, items, extra } = props;
  const data = items[index]!;
  const active = extra.activeID === data.id;
  return (
    <div className="w-(--side-bar-expand-width) px-3">
      <div
        className={cx(
          `
            w-full flex flex-row rounded-md select-none cursor-pointer
            ease-in-out transition-all duration-300
          `,
          active ? extra.opened && "bg-(--theme-color-main)" : extra.opened && "hover:bg-black/5"
        )}>
        <div
          className={cx(
            `
              w-[calc(50%-var(--spacing)*3)]
              flex justify-center items-center py-1 rounded-md
              ease-in-out transition-all duration-300
            `,
            active ? "bg-(--theme-color-main)" : !extra.opened && "hover:bg-black/5"
          )}>
          <NeteaseImage
            cache
            pause={extra.fastLocation}
            image={NeteaseNetworkImage.fromPlaylistCover(data).setSize(
              ImageConstants.NavPlaylistCoverSize
            )}
            className="w-[60%] rounded-md"
          />
        </div>
        <div
          className={cx(
            `
              w-[calc(50%+var(--spacing)*3)] flex overflow-x-hidden flex-col justify-center items-start
              py-1 pr-3
              ease-in-out transition-all duration-300
            `,
            !extra.opened && "opacity-0"
          )}>
          <span className="text-xs w-full font-semibold truncate">{data.name}</span>
          <span className="text-xs w-full font-normal opacity-50">{data.trackCount} 首</span>
        </div>
      </div>
    </div>
  );
};
