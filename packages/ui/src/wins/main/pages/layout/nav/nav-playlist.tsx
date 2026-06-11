import {
  type FC,
  memo,
  type Ref,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { NeteaseNetworkImage, NeteasePlaylistSummary, NeteaseUser } from "@/common/netease/models";
import RendererTheme from "@/common/player/ui";
import NeteaseImage from "@/common/components/display/image/netease-image";
import { cx } from "@emotion/css";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useLocation } from "react-router-dom";
import { RoutePathMain } from "@/common/routes";
import RendererImageConstants from "@/common/constants/image";

import VirtualList, { type VirtualListRow } from "@/common/components/layout/virtual_list";
import AppEmpty from "@/common/components/fallback/app-empty";

export type NavPlaylistRef = {
  scrollTop: NormalFunc;
};

interface NavPlaylistProps {
  ref?: Ref<NavPlaylistRef>;
  keyword?: string;
  className?: string;
  user: NeteaseUser;
  sidebarOpen: boolean;
  category: "user" | "star";
  setCanScrollTop: NormalFunc<[enable: boolean]>;
}

const NavPlaylist: FC<NavPlaylistProps> = ({
  ref,
  user,
  className,
  sidebarOpen,
  category,
  setCanScrollTop,
  keyword
}) => {
  const { id } = RoutePathMain.playlist.parseQuery(useLocation());
  const [fastLocation, setFastLocation] = useState(false);
  const { jumpPlaylistPage } = usePageJump();

  const containerRef = useRef<Nullable<HTMLDivElement>>(null);

  useScrollAutoHide(containerRef, 800, !sidebarOpen);

  const playlistItems = useMemo(() => {
    let playlist = category === "user" ? user.userPlaylists : user.starPlaylists;
    const k = keyword?.trim().toLocaleLowerCase();
    if (k) {
      playlist = playlist.filter(
        (p) =>
          p.name.toLocaleLowerCase().includes(k) ||
          p.tags.some((t) => t.toLocaleLowerCase().includes(k)) ||
          p.description.toLocaleLowerCase().includes(k)
      );
    }
    return playlist;
  }, [category, keyword, user.starPlaylists, user.userPlaylists]);

  const onItemClick = useCallback(
    (item: NeteasePlaylistSummary) => jumpPlaylistPage(item.id, "normal"),
    [jumpPlaylistPage]
  );

  const scrollTop = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    setFastLocation(true);
    RendererTheme.smoothScrollTo(container, 0, 500).finally(() => {
      setFastLocation(false);
    });
  }, []);

  useImperativeHandle(ref, () => ({ scrollTop }), [scrollTop]);

  return (
    <div
      className={cx(
        `
          w-full h-full relative overflow-y-auto overflow-x-hidden
          contain-layout will-change-scroll scrollbar
        `,
        className
      )}
      ref={containerRef}>
      {playlistItems.length === 0 && <AppEmpty tips="无搜索结果" />}
      <VirtualList
        RowComponent={RowComponent}
        items={playlistItems}
        itemHeight={57}
        containerRef={containerRef}
        overscan={10}
        onRangeUpdate={(range) => setCanScrollTop(range[0] > 5)}
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
          active
            ? extra.opened && "bg-(--theme-color-main) text-(--text-color-on-main)"
            : extra.opened && "hover:bg-black/5"
        )}>
        <div
          className={cx(
            `
              w-[calc(50%-var(--spacing)*3)]
              flex justify-center items-center py-1 rounded-md
              ease-in-out transition-all duration-300
            `,
            active
              ? "bg-(--theme-color-main) text-(--text-color-on-main)"
              : !extra.opened && "hover:bg-black/5"
          )}>
          <NeteaseImage
            cache
            pause={extra.fastLocation}
            image={NeteaseNetworkImage.fromPlaylistCover(data).setSize(
              RendererImageConstants.NavPlaylistCoverSize
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
