import { FC, memo, useCallback, useRef, useState } from "react";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";
import {
  NeteaseNetworkImage,
  NeteasePlaylistSummary,
  NeteaseUser
} from "@mahiru/ui/public/source/netease/models";
import AppUI from "@mahiru/ui/public/player/ui";
import { LayoutConfig } from "@mahiru/ui/windows/main/store/layout/config";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { useLocation, useNavigate } from "react-router-dom";
import { cx } from "@emotion/css";
import { getLayoutStoreSnapshot } from "@mahiru/ui/windows/main/store/layout";
import { RoutePathMain } from "@mahiru/ui/public/routes";
import { PlaylistSource } from "@mahiru/ui/public/enum";
import ImageConstants from "@mahiru/ui/windows/main/constants/image";

import VirtualList, { VirtualListRow } from "@mahiru/ui/public/components/virtual_list/VirtualList";

interface NavPlaylistProps {
  user: Nullable<NeteaseUser>;
  layout: LayoutConfig;
}

const NavPlaylist: FC<NavPlaylistProps> = ({ user, layout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = RoutePathMain.playlist.parseQuery(location);

  const [fastLocation, setFastLocation] = useState(false);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  useScrollAutoHide(containerRef, 800, !layout.sideBar);

  const gotoTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setFastLocation(true);
    AppUI.smoothScrollTo(container, 0, 500).finally(() => {
      setFastLocation(false);
    });
  }, []);

  const onRangeChange = useCallback(
    (range: IndexRange) => {
      const { updateLayout } = getLayoutStoreSnapshot();
      if (range[0] > 5) {
        updateLayout(layout.copy().setScrollTop(gotoTop));
      } else if (range[0] <= 5) {
        updateLayout(layout.copy().setScrollTop(undefined));
      }
    },
    [gotoTop, layout]
  );

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
        onRangeUpdate={onRangeChange}
        extraData={{ fastLocation, opened: layout.sideBar, activeID: Number(id) }}
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
