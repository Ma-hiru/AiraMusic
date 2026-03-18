import { FC, memo, useCallback, useRef, useState } from "react";
import { useScrollAutoHide } from "@mahiru/ui/public/hooks/useScrollAutoHide";

import VirtualList, { VirtualListRow } from "@mahiru/ui/public/components/virtual_list/VirtualList";
import {
  NeteaseNetworkImage,
  NeteasePlaylistSummary,
  NeteaseUser
} from "@mahiru/ui/public/models/netease";
import AppUI from "@mahiru/ui/public/entry/ui";
import { LayoutConfig } from "@mahiru/ui/main/store/layout/config";
import NeteaseImage from "@mahiru/ui/public/components/image/NeteaseImage";
import { NeteaseImageSize } from "@mahiru/ui/public/enum";
import { useNavigate } from "react-router-dom";
import { RoutePathConstants } from "@mahiru/ui/main/constants";
import { cx } from "@emotion/css";

interface NavPlaylistProps {
  user: Nullable<NeteaseUser>;
  layout: LayoutConfig;
}

const NavPlaylist: FC<NavPlaylistProps> = ({ user, layout }) => {
  const navigate = useNavigate();
  const [fastLocation, setFastLocation] = useState(false);
  const containerRef = useRef<Nullable<HTMLDivElement>>(null);
  useScrollAutoHide(containerRef, 800, !layout.sideBar);

  const gotoTop = useCallback((currentItem?: number) => {
    return () => {
      const container = containerRef.current;
      if (container) {
        if (currentItem && currentItem > 50) {
          setFastLocation(true);
          setTimeout(() => setFastLocation(true), Math.floor((currentItem / 10) * 100));
        }
        AppUI.smoothScrollTo(container, 0, 500);
      }
    };
  }, []);

  const onRangeChange = useCallback(
    (range: IndexRange) => {
      if (range[0] > 5) {
        layout.setScrollTop(gotoTop(range[0]));
      } else if (range[0] <= 5) {
        layout.setScrollTop(undefined);
      }
    },
    [gotoTop, layout]
  );

  const onItemClick = useCallback(
    (item: NeteasePlaylistSummary) => {
      navigate(RoutePathConstants.playlist(item.id, "playlist"));
    },
    [navigate]
  );

  return (
    <div
      className="
        w-full h-full relative overflow-y-auto overflow-x-hidden
        contain-content will-change-scroll scrollbar
      "
      ref={containerRef}>
      <VirtualList
        RowComponent={RowComponent}
        items={user!.userPlaylists}
        itemHeight={57}
        containerRef={containerRef}
        overscan={10}
        onRangeUpdate={onRangeChange}
        extraData={{ fastLocation, opened: layout.sideBar }}
        onItemClick={onItemClick}
      />
    </div>
  );
};
export default memo(NavPlaylist);

const RowComponent: VirtualListRow<
  NeteasePlaylistSummary,
  { fastLocation: boolean; opened: boolean }
> = (props) => {
  const { index, items, extra } = props;
  const data = items[index]!;
  return (
    <div className="w-40 px-3">
      <div
        className={cx(
          `w-full flex flex-row rounded-md select-none cursor-pointer`,
          extra.opened && "hover:bg-black/5"
        )}>
        <div
          className={cx(
            `w-[calc(50%-var(--spacing)*3)] flex justify-center items-center py-1 rounded-md`,
            !extra.opened && "hover:bg-black/5"
          )}>
          <NeteaseImage
            cache
            pause={extra.fastLocation}
            image={NeteaseNetworkImage.fromPlaylistCover(data)
              .setSize(NeteaseImageSize.xs)
              .setAlt(data.name)}
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
