import { cx } from "@emotion/css";
import { Lock } from "lucide-react";
import { useLocation } from "react-router-dom";
import {
  memo,
  useRef,
  type FC,
  useMemo,
  type Ref,
  useState,
  useCallback,
  useImperativeHandle
} from "react";
import { RoutePathMain } from "@/common/routes";
import { usePageJump } from "@/wins/main/hooks/use-page-jump";
import { useScrollAutoHide } from "@/common/hooks/use-scroll-auto-hide";
import { NeteaseUser, NeteaseNetworkImage, NeteasePlaylistSummary } from "@/common/netease/models";
import RendererTheme from "@/common/player/ui";
import AppEmpty from "@/common/components/fallback/app-empty";
import RendererImageConstants from "@/common/constants/image";
import NeteaseImage from "@/common/components/display/image/netease-image";
import VirtualList, { type VirtualListRow } from "@/common/components/layout/virtual_list";

export type NavPlaylistRef = {
  scrollTop: NormalFunc;
};

interface NavPlaylistProps {
  ref?: Ref<NavPlaylistRef>;
  keyword?: string;
  user: NeteaseUser;
  className?: string;
  sidebarOpen: boolean;
  category: "star" | "user";
  setCanScrollTop: NormalFunc<[enable: boolean]>;
}

const NavPlaylist: FC<NavPlaylistProps> = ({
  ref,
  user,
  className,
  setCanScrollTop,
  keyword,
  category,
  sidebarOpen
}) => {
  const { id } = RoutePathMain.playlist.parseQuery(useLocation(), false);
  const { jumpPlaylistPage } = usePageJump();
  const [fastLocation, setFastLocation] = useState(false);

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
      ref={containerRef}
      className={cx(
        `
          w-full h-full relative overflow-y-auto overflow-x-hidden
          contain-layout will-change-scroll scrollbar
        `,
        className
      )}>
      {playlistItems.length === 0 && <AppEmpty tips="无搜索结果" />}
      <VirtualList
        overscan={10}
        itemHeight={57}
        items={playlistItems}
        containerRef={containerRef}
        RowComponent={RowComponent}
        extraData={{ fastLocation, opened: sidebarOpen, activeID: Number(id), category }}
        onItemClick={onItemClick}
        onRangeUpdate={(range) => setCanScrollTop(range[0] > 5)}
      />
    </div>
  );
};

export default memo(NavPlaylist);

const RowComponent: VirtualListRow<
  NeteasePlaylistSummary,
  { opened: boolean; activeID: number; fastLocation: boolean; category: "star" | "user" }
> = (props) => {
  const { extra, index, items } = props;
  const data = items[index]!;
  const isPrivate = extra.category === "user" && NeteasePlaylistSummary.isPrivacy(data);
  const active = extra.activeID === data.id;
  const cover = NeteaseNetworkImage.fromPlaylistCover(data).setSize(
    RendererImageConstants.NavPlaylistCoverSize
  );
  return (
    <div className="w-(--side-bar-expand-width) px-3">
      <div
        className={cx(
          `
            w-full flex flex-row rounded-md select-none cursor-pointer
            ease-in-out transition-all duration-300 group
          `,
          active
            ? extra.opened && "bg-primary text-primary-text"
            : extra.opened && "hover:bg-black/5"
        )}>
        <div
          className={cx(
            `
              w-[calc(50%-var(--spacing)*3)] relative overflow-hidden
              flex justify-center items-center py-1 rounded-md
              ease-in-out transition-all duration-300
            `,
            active ? "bg-primary text-primary-text" : !extra.opened && "hover:bg-black/5"
          )}>
          <NeteaseImage
            className="w-[60%] rounded-md"
            image={cover}
            pause={extra.fastLocation}
            cache
          />
          {isPrivate && (
            <div className="absolute w-[60%] aspect-square left-[20%] justify-center items-center bg-black/30 rounded-md hidden group-hover:flex">
              <Lock className="size-3" />
            </div>
          )}
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
          <span className="text-[11px] w-full font-semibold line-clamp-2">{data.name}</span>
          <span className="text-[10px] w-full font-normal opacity-50">{data.trackCount} 首</span>
        </div>
      </div>
    </div>
  );
};
